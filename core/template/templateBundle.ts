// Sharing Templates between people: a bundle carries Templates only (never Projects, Drafts or Glossaries),
// the preview compares by meaning, and an import never deletes anything.
import { newId } from '#core/shared/ids.ts'
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'
import type { Template, TemplateSection } from '#core/template/templateTypes.ts'

export const BUNDLE_FORMAT = 'whetstone/templates'

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

const pickSection = (s: TemplateSection): TemplateSection => ({
  key: s.key,
  heading: s.heading,
  shape: s.shape,
  locked: s.locked,
  guidance: s.guidance,
  target: s.target,
  ...(s.entryFormat ? { entryFormat: s.entryFormat } : {}),
})

const pickTemplate = (t: Template): Template => ({
  id: t.id,
  workItemType: t.workItemType,
  name: t.name,
  version: t.version,
  isDefault: t.isDefault,
  sections: t.sections.map(pickSection),
  method: t.method,
  iterationLogHeading: t.iterationLogHeading,
  updatedAt: t.updatedAt,
})

export const exportBundle = (templates: Template[], now: string): Bundle => ({
  format: BUNDLE_FORMAT,
  formatVersion: 1,
  exportedAt: now,
  templates: templates.map(pickTemplate),
})

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** What a Template means: structure, method and names — not its id, version, timestamps or whitespace. */
const meaning = (t: Template) =>
  JSON.stringify({
    type: t.workItemType,
    name: norm(t.name),
    log: norm(t.iterationLogHeading),
    method: norm(t.method),
    sections: t.sections.map((s) => ({ ...pickSection(s), heading: norm(s.heading), guidance: norm(s.guidance) })),
  })

const isSection = (s: unknown): s is TemplateSection => {
  const r = s as Record<string, unknown>
  return !!r && typeof r.key === 'string' && typeof r.heading === 'string' && (r.shape === 'prose' || r.shape === 'entries') && typeof r.locked === 'boolean' && typeof r.target === 'string'
}

const isTemplate = (t: unknown): t is Template => {
  const r = t as Record<string, unknown>
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    WORK_ITEM_TYPES.includes(r.workItemType as Template['workItemType']) &&
    typeof r.method === 'string' &&
    Array.isArray(r.sections) &&
    r.sections.length > 0 &&
    r.sections.every(isSection)
  )
}

export function previewImport(bundle: unknown, existing: Template[]): { ok: true; items: ImportItem[] } | { ok: false; reason: string } {
  const b = bundle as Partial<Bundle> | null
  if (!b || b.format !== BUNDLE_FORMAT || !Array.isArray(b.templates)) return { ok: false, reason: 'This file is not a Whetstone Template bundle.' }
  if (!b.templates.every(isTemplate)) return { ok: false, reason: 'The bundle contains a Template that is incomplete or malformed.' }

  const items = b.templates.map((raw): ImportItem => {
    const template = pickTemplate({
      ...raw,
      iterationLogHeading: raw.iterationLogHeading ?? `${raw.workItemType} Iteration Log`,
      sections: raw.sections.map((s) => ({ ...s, guidance: s.guidance ?? '' })),
    })
    const match =
      existing.find((e) => e.id === template.id) ?? existing.find((e) => e.workItemType === template.workItemType && norm(e.name) === norm(template.name))
    if (!match) return { template, status: 'new', selected: true }
    const status = meaning(match) === meaning(template) ? 'identical' : 'changed'
    return { template, status, matchId: match.id, selected: false }
  })
  return { ok: true, items }
}

/** The Templates to write for the selected items. Nothing is ever deleted; Defaults are never overwritten. */
export function applyImport(existing: Template[], items: ImportItem[], now: string): Template[] {
  const ids = new Set(existing.map((t) => t.id))
  const names = new Set(existing.map((t) => `${t.workItemType}/${norm(t.name)}`))
  const writes: Template[] = []
  for (const item of items) {
    if (!item.selected || item.status === 'identical') continue
    const match = existing.find((t) => t.id === item.matchId)
    if (item.status === 'changed' && match && !match.isDefault) {
      writes.push({ ...item.template, id: match.id, isDefault: false, version: match.version + 1, updatedAt: now })
      continue
    }
    let name = item.template.name
    if (match?.isDefault || names.has(`${item.template.workItemType}/${norm(name)}`)) name = `${name} (imported)`
    const id = ids.has(item.template.id) ? newId('t') : item.template.id
    ids.add(id)
    writes.push({ ...item.template, id, name, isDefault: false, version: 1, updatedAt: now })
  }
  return writes
}
