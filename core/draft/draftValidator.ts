// Checks Draft content a session submits against its Template: shape of the JSON, every Section
// present once and in Template order, empty Sections explained with "N/A — reason", Entries well formed.
import type { DraftContent } from '#core/draft/draftTypes.ts'
import type { Reason, Validation } from '#core/shared/validation.ts'
import type { Template, TemplateSection } from '#core/template/templateTypes.ts'

type ContentSection = DraftContent['sections'][number]
type ContentEntry = NonNullable<ContentSection['entries']>[number]

// "N/A", then a dash of any kind, then at least one non-space character of reason.
const NA_WITH_REASON = /^N\/A\s*[—–-]+\s*\S/i
// "N/A" as a whole word at the start, with or without a reason after it.
const NA_BARE = /^N\/A\b/i
// A line starting with "Given", followed later by a line starting with "Then".
const GHERKIN = /^\s*Given\b[\s\S]*^\s*Then\b/im

const MALFORMED_CONTENT_MESSAGE =
  'Expected { "title": string, "sections": [{ "key": string, "body"?: string, "entries"?: [{ "title": string, "body": string }] }] }.'

/** An empty Section must say "N/A — reason". */
export const isNotApplicable = (body: string | undefined) => NA_WITH_REASON.test(body?.trim() ?? '')

const hasContent = (def: TemplateSection, section: ContentSection) => {
  if (def.shape === 'entries') return (section.entries?.length ?? 0) > 0
  const body = section.body?.trim() ?? ''
  return body !== '' && !NA_BARE.test(body)
}

/** An Entry as it arrives in untrusted JSON: an object with a string title and body. */
export const isTitledEntry = (entry: unknown): boolean => {
  if (!entry || typeof entry !== 'object') return false
  const { title, body } = entry as Record<string, unknown>
  return typeof title === 'string' && typeof body === 'string'
}

const isContentSection = (section: unknown): boolean => {
  if (!section || typeof section !== 'object') return false
  const { key, body, entries } = section as Record<string, unknown>
  if (typeof key !== 'string' || (body !== undefined && typeof body !== 'string')) return false
  if (entries === undefined) return true
  return Array.isArray(entries) && (entries as unknown[]).every(isTitledEntry)
}

const isContent = (content: unknown): content is DraftContent => {
  if (!content || typeof content !== 'object') return false
  const { title, sections } = content as Record<string, unknown>
  if (typeof title !== 'string' || !Array.isArray(sections)) return false
  return sections.every(isContentSection)
}

/** A prose Section given entries, or an entries Section given a prose body that is not "N/A — reason". */
function wrongShape(def: TemplateSection, section: ContentSection): Reason[] {
  const at = { sectionKey: def.key }
  if (def.shape === 'prose' && section.entries?.length)
    return [
      { code: 'wrong-shape', ...at, message: `"${def.heading}" is a prose Section: give it a "body", not "entries".` },
    ]
  const hasProseInstead = !section.entries?.length && section.body?.trim() && !isNotApplicable(section.body)
  if (def.shape === 'entries' && hasProseInstead)
    return [
      {
        code: 'wrong-shape',
        ...at,
        message: `"${def.heading}" is an entries Section: give it "entries" [{ title, body }], or a body of "N/A — reason" when empty.`,
      },
    ]
  return []
}

/** An empty Section is allowed only when it is not Locked and says "N/A — reason". */
function emptySection(def: TemplateSection, section: ContentSection): Reason[] {
  const at = { sectionKey: def.key }
  if (def.locked)
    return [
      {
        code: 'empty-locked-section',
        ...at,
        message: `"${def.heading}" is a Locked Section and must have content — N/A is not allowed.`,
      },
    ]
  if (!isNotApplicable(section.body))
    return [
      {
        code: 'empty-without-reason',
        ...at,
        message: `"${def.heading}" is empty; its body must say "N/A — <reason>".`,
      },
    ]
  return []
}

function checkEntry(def: TemplateSection, entry: ContentEntry, index: number): Reason[] {
  const at = { sectionKey: def.key }
  const trimmedTitle = entry.title?.trim()
  const titleSuffix = trimmedTitle ? ` "${trimmedTitle}"` : ''
  const name = `"${def.heading}" Entry ${index + 1}${titleSuffix}`
  if (!trimmedTitle || !entry.body?.trim())
    return [{ code: 'malformed-entry', ...at, message: `${name} needs both a title and a body.` }]
  if (def.entryFormat === 'gherkin' && !GHERKIN.test(entry.body))
    return [{ code: 'malformed-entry', ...at, message: `${name} must be written as Given … When … Then lines.` }]
  return []
}

function checkSection(def: TemplateSection, section: ContentSection): Reason[] {
  const shapeReasons = wrongShape(def, section)
  if (shapeReasons.length) return shapeReasons
  if (!hasContent(def, section)) return emptySection(def, section)
  return (section.entries ?? []).flatMap((entry, index) => checkEntry(def, entry, index))
}

/** Walks the submitted Sections once: unknown and duplicate keys, then each known Section's own checks. */
function checkSubmittedSections(template: Template, content: DraftContent) {
  const defs = new Map(template.sections.map((def) => [def.key, def]))
  const reasons: Reason[] = []
  const seen = new Set<string>()
  const order: string[] = []
  for (const section of content.sections) {
    const def = defs.get(section.key)
    if (!def) {
      const allowedKeys = [...defs.keys()].join(', ')
      reasons.push({
        code: 'unknown-section',
        sectionKey: section.key,
        message: `Section key "${section.key}" is not in the Template. Allowed keys: ${allowedKeys}.`,
      })
      continue
    }
    if (seen.has(section.key)) {
      reasons.push({
        code: 'duplicate-section',
        sectionKey: section.key,
        message: `Section "${def.heading}" appears more than once.`,
      })
      continue
    }
    seen.add(section.key)
    order.push(section.key)
    reasons.push(...checkSection(def, section))
  }
  return { reasons, seen, order }
}

function missingSections(template: Template, seen: Set<string>): Reason[] {
  return template.sections
    .filter((def) => !seen.has(def.key))
    .map((def) => ({
      code: 'missing-section',
      sectionKey: def.key,
      message: `Section "${def.heading}" is missing — never omit a Section; write "N/A — reason" if it has no content.`,
    }))
}

function sectionOrder(template: Template, seen: Set<string>, order: string[]): Reason[] {
  const expected = template.sections.map((def) => def.key).filter((key) => seen.has(key))
  if (expected.join() === order.join()) return []
  const headings = template.sections.map((def) => def.heading).join(' → ')
  return [{ code: 'section-order', message: `Sections must follow the Template order: ${headings}.` }]
}

export function validate(template: Template, content: DraftContent): Validation {
  if (!isContent(content))
    return { ok: false, reasons: [{ code: 'malformed-content', message: MALFORMED_CONTENT_MESSAGE }] }
  const reasons: Reason[] = []
  if (!content.title?.trim()) reasons.push({ code: 'missing-title', message: 'The Draft needs a Title.' })

  const submitted = checkSubmittedSections(template, content)
  reasons.push(...submitted.reasons)
  reasons.push(...missingSections(template, submitted.seen))
  reasons.push(...sectionOrder(template, submitted.seen, submitted.order))

  return reasons.length ? { ok: false, reasons } : { ok: true }
}
