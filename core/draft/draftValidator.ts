import type { DraftContent } from '#core/draft/draftTypes.ts'
import type { Reason, Validation } from '#core/shared/validation.ts'
import type { Template, TemplateSection } from '#core/template/templateTypes.ts'

type ContentSection = DraftContent['sections'][number]

const NA_WITH_REASON = /^N\/A\s*[—–-]+\s*\S/i
const NA_BARE = /^N\/A\b/i

/** An empty Section must say "N/A — reason". */
export const isNotApplicable = (body: string | undefined) => NA_WITH_REASON.test(body?.trim() ?? '')

const hasContent = (def: TemplateSection, s: ContentSection) => {
  if (def.shape === 'entries') return (s.entries?.length ?? 0) > 0
  const body = s.body?.trim() ?? ''
  return body !== '' && !NA_BARE.test(body)
}

/** An Entry as it arrives in untrusted JSON: an object with a string title and body. */
export const isTitledEntry = (entry: unknown): boolean => {
  if (!entry || typeof entry !== 'object') return false
  const { title, body } = entry as Record<string, unknown>
  return typeof title === 'string' && typeof body === 'string'
}

const isContent = (c: unknown): c is DraftContent => {
  if (!c || typeof c !== 'object') return false
  const { title, sections } = c as Record<string, unknown>
  if (typeof title !== 'string' || !Array.isArray(sections)) return false
  return sections.every((s) => {
    if (!s || typeof s !== 'object') return false
    const { key, body, entries } = s as Record<string, unknown>
    if (typeof key !== 'string' || (body !== undefined && typeof body !== 'string')) return false
    if (entries === undefined) return true
    return Array.isArray(entries) && (entries as unknown[]).every(isTitledEntry)
  })
}

export function validate(template: Template, content: DraftContent): Validation {
  if (!isContent(content))
    return {
      ok: false,
      reasons: [
        {
          code: 'malformed-content',
          message:
            'Expected { "title": string, "sections": [{ "key": string, "body"?: string, "entries"?: [{ "title": string, "body": string }] }] }.',
        },
      ],
    }
  const reasons: Reason[] = []
  if (!content.title?.trim()) reasons.push({ code: 'missing-title', message: 'The Draft needs a Title.' })

  const defs = new Map(template.sections.map((d) => [d.key, d]))
  const seen = new Set<string>()
  const order: string[] = []
  for (const s of content.sections) {
    const def = defs.get(s.key)
    if (!def) {
      reasons.push({
        code: 'unknown-section',
        sectionKey: s.key,
        message: `Section key "${s.key}" is not in the Template. Allowed keys: ${[...defs.keys()].join(', ')}.`,
      })
      continue
    }
    if (seen.has(s.key)) {
      reasons.push({
        code: 'duplicate-section',
        sectionKey: s.key,
        message: `Section "${def.heading}" appears more than once.`,
      })
      continue
    }
    seen.add(s.key)
    order.push(s.key)
    reasons.push(...checkSection(def, s))
  }

  for (const def of template.sections) {
    if (!seen.has(def.key))
      reasons.push({
        code: 'missing-section',
        sectionKey: def.key,
        message: `Section "${def.heading}" is missing — never omit a Section; write "N/A — reason" if it has no content.`,
      })
  }

  const expected = template.sections.map((d) => d.key).filter((k) => seen.has(k))
  if (expected.join() !== order.join())
    reasons.push({
      code: 'section-order',
      message: `Sections must follow the Template order: ${template.sections.map((d) => d.heading).join(' → ')}.`,
    })

  return reasons.length ? { ok: false, reasons } : { ok: true }
}

const GHERKIN = /^\s*Given\b[\s\S]*^\s*Then\b/im

function checkSection(def: TemplateSection, s: ContentSection): Reason[] {
  const at = { sectionKey: def.key }
  if (def.shape === 'prose' && s.entries?.length)
    return [
      { code: 'wrong-shape', ...at, message: `"${def.heading}" is a prose Section: give it a "body", not "entries".` },
    ]
  if (def.shape === 'entries' && !s.entries?.length && s.body?.trim() && !isNotApplicable(s.body))
    return [
      {
        code: 'wrong-shape',
        ...at,
        message: `"${def.heading}" is an entries Section: give it "entries" [{ title, body }], or a body of "N/A — reason" when empty.`,
      },
    ]

  if (!hasContent(def, s)) {
    if (def.locked)
      return [
        {
          code: 'empty-locked-section',
          ...at,
          message: `"${def.heading}" is a Locked Section and must have content — N/A is not allowed.`,
        },
      ]
    if (!isNotApplicable(s.body))
      return [
        {
          code: 'empty-without-reason',
          ...at,
          message: `"${def.heading}" is empty; its body must say "N/A — <reason>".`,
        },
      ]
    return []
  }

  const reasons: Reason[] = []
  s.entries?.forEach((e, i) => {
    const name = `"${def.heading}" Entry ${i + 1}${e.title?.trim() ? ` "${e.title.trim()}"` : ''}`
    if (!e.title?.trim() || !e.body?.trim())
      reasons.push({ code: 'malformed-entry', ...at, message: `${name} needs both a title and a body.` })
    else if (def.entryFormat === 'gherkin' && !GHERKIN.test(e.body))
      reasons.push({ code: 'malformed-entry', ...at, message: `${name} must be written as Given … When … Then lines.` })
  })
  return reasons
}
