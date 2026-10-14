// Sharing Templates between people: a bundle carries Templates only (never Projects, Drafts or Glossaries),
// the preview compares by meaning, and an import never deletes anything.
import { newId } from '#core/shared/ids.ts'
import { defaultIterationLogTarget, isWorkItemType } from '#core/shared/workItemType.ts'
import type { Template, TemplateSection } from '#core/template/templateTypes.ts'

export const BUNDLE_FORMAT = 'grillingstone/templates'
/** Bundles exported before the tool was renamed from Whetstone still import. */
const LEGACY_BUNDLE_FORMAT = 'whetstone/templates'
const IMPORTABLE_FORMATS: unknown[] = [BUNDLE_FORMAT, LEGACY_BUNDLE_FORMAT]

export interface Bundle {
  format: typeof BUNDLE_FORMAT
  formatVersion: 1
  exportedAt: string
  templates: Template[]
}

export type ImportStatus = 'new' | 'changed' | 'identical'
export interface ImportItem {
  template: Template
  status: ImportStatus
  /** Id of the local Template this one matches. */
  matchId?: string
  selected: boolean
}

/** Only a Template Section's own fields, so nothing else travels in a bundle. */
const pickSection = (section: TemplateSection): TemplateSection => ({
  key: section.key,
  heading: section.heading,
  shape: section.shape,
  locked: section.locked,
  guidance: section.guidance,
  target: section.target,
  ...(section.entryFormat ? { entryFormat: section.entryFormat } : {}),
})

/** Only a Template's own fields, so nothing else travels in a bundle. */
const pickTemplate = (template: Template): Template => ({
  id: template.id,
  workItemType: template.workItemType,
  name: template.name,
  version: template.version,
  isDefault: template.isDefault,
  sections: template.sections.map(pickSection),
  method: template.method,
  iterationLogHeading: template.iterationLogHeading,
  ...(template.iterationLogTarget ? { iterationLogTarget: template.iterationLogTarget } : {}),
  updatedAt: template.updatedAt,
})

export const exportBundle = (templates: Template[], now: string): Bundle => ({
  format: BUNDLE_FORMAT,
  formatVersion: 1,
  exportedAt: now,
  templates: templates.map(pickTemplate),
})

// Any run of whitespace, collapsed to one space when comparing by meaning.
const WHITESPACE_RUN = /\s+/g

const norm = (text: string) => text.replace(WHITESPACE_RUN, ' ').trim()

/** What a Template means: structure, method and names — not its id, version, timestamps or whitespace. */
const meaning = (template: Template) =>
  JSON.stringify({
    type: template.workItemType,
    name: norm(template.name),
    log: norm(template.iterationLogHeading),
    logTarget: template.iterationLogTarget ?? defaultIterationLogTarget(template.workItemType),
    method: norm(template.method),
    sections: template.sections.map((section) => ({
      ...pickSection(section),
      heading: norm(section.heading),
      guidance: norm(section.guidance),
    })),
  })

const isSection = (section: unknown): section is TemplateSection => {
  const fields = section as Record<string, unknown>
  return (
    !!fields &&
    typeof fields.key === 'string' &&
    typeof fields.heading === 'string' &&
    (fields.shape === 'prose' || fields.shape === 'entries') &&
    typeof fields.locked === 'boolean' &&
    typeof fields.target === 'string'
  )
}

const isTemplate = (template: unknown): template is Template => {
  const fields = template as Record<string, unknown>
  return (
    !!fields &&
    typeof fields.id === 'string' &&
    typeof fields.name === 'string' &&
    isWorkItemType(fields.workItemType) &&
    typeof fields.method === 'string' &&
    Array.isArray(fields.sections) &&
    fields.sections.length > 0 &&
    fields.sections.every(isSection)
  )
}

/** The local Template an imported one matches: the same id, or else the same type and name. */
const findMatch = (existing: Template[], template: Template) =>
  existing.find((local) => local.id === template.id) ??
  existing.find((local) => local.workItemType === template.workItemType && norm(local.name) === norm(template.name))

export function previewImport(
  bundle: unknown,
  existing: Template[],
): { ok: true; items: ImportItem[] } | { ok: false; reason: string } {
  const candidate = bundle as Partial<Bundle> | null
  if (!candidate || !IMPORTABLE_FORMATS.includes(candidate.format) || !Array.isArray(candidate.templates))
    return { ok: false, reason: 'This file is not a Grilling Stone Template bundle.' }
  if (!candidate.templates.every(isTemplate))
    return { ok: false, reason: 'The bundle contains a Template that is incomplete or malformed.' }

  const items = candidate.templates.map((raw): ImportItem => {
    const template = pickTemplate({
      ...raw,
      iterationLogHeading: raw.iterationLogHeading ?? `${raw.workItemType} Iteration Log`,
      sections: raw.sections.map((section) => ({ ...section, guidance: section.guidance ?? '' })),
    })
    const match = findMatch(existing, template)
    if (!match) return { template, status: 'new', selected: true }
    const status = meaning(match) === meaning(template) ? 'identical' : 'changed'
    return { template, status, matchId: match.id, selected: false }
  })
  return { ok: true, items }
}

/** The Templates to write for the selected items. Nothing is ever deleted; Defaults are never overwritten. */
export function applyImport(existing: Template[], items: ImportItem[], now: string): Template[] {
  const nameKey = (template: Template, name: string) => `${template.workItemType}/${norm(name)}`
  const ids = new Set(existing.map((template) => template.id))
  const names = new Set(existing.map((template) => nameKey(template, template.name)))
  const writes: Template[] = []
  for (const item of items) {
    if (!item.selected || item.status === 'identical') continue
    const match = existing.find((template) => template.id === item.matchId)
    if (item.status === 'changed' && match && !match.isDefault) {
      writes.push({ ...item.template, id: match.id, isDefault: false, version: match.version + 1, updatedAt: now })
      continue
    }
    let name = item.template.name
    if (match?.isDefault || names.has(nameKey(item.template, name))) name = `${name} (imported)`
    const id = ids.has(item.template.id) ? newId('t') : item.template.id
    ids.add(id)
    writes.push({ ...item.template, id, name, isDefault: false, version: 1, updatedAt: now })
  }
  return writes
}
