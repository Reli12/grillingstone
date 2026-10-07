// Template Validator: the gate every saved Template passes — hand-made, imported, or written by a
// Template Session. Session output must also follow the method skeleton.
import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'
import type { Reason, Validation } from '#core/shared/validation.ts'
import { allowedTargets, isWorkItemType, WORK_ITEM_TYPES, type WorkItemType } from '#core/shared/workItemType.ts'
import type { TemplateSection } from '#core/template/templateTypes.ts'

/** What defines a Template's meaning; ids, versions and timestamps are the store's business. */
export interface TemplateContent {
  /** Absent in a Template Session's submission — the session knows its type and passes it as an option. */
  workItemType?: WorkItemType
  name: string
  sections: TemplateSection[]
  method: string
  iterationLogHeading?: string
  /** Absent means the type's default field (Templates made before Bugs existed). */
  iterationLogTarget?: string
}

const KEY = /^[A-Za-z][A-Za-z0-9_]*$/

const isContent = (c: unknown): c is TemplateContent => {
  if (!c || typeof c !== 'object') return false
  const { name, sections, method } = c as Record<string, unknown>
  return (
    typeof name === 'string' &&
    typeof method === 'string' &&
    Array.isArray(sections) &&
    sections.every((s) => s && typeof s === 'object' && typeof s.key === 'string' && typeof s.heading === 'string')
  )
}

/** The parts every method written by a Template Session must have, as markdown headings, in this order. */
export const SKELETON_PARTS = ['Purpose', 'Guiding principle', 'Sections', 'Working process'] as const

const hasHeading = (method: string, part: string) => new RegExp(`^#{1,4}\\s+(\\d+[.)]\\s*)?${part}\\b`, 'im').test(method)

/** The skeleton pre-filled for a Template built by hand from nothing — a nudge, never enforced there. */
export const methodSkeleton = (name: string) => `# ${name} Guide

## Purpose
What this work item is for and who reads it (BA, developer, tester).

## Guiding principle
- The rules that apply throughout, e.g. reference documented decisions, flag new ones instead of deciding them silently.

## Sections
### <Section heading>
The rules for this Section.
Good example: …
Bad example: … (and why it is wrong)

## Working process
1. The steps Claude follows when writing a Draft with this Template.
`

function skeletonReasons(method: string): Reason[] {
  const missing = SKELETON_PARTS.filter((p) => !hasHeading(method, p))
  if (missing.length)
    return [{ code: 'method-missing-part', message: `The method must have these markdown headings: ${SKELETON_PARTS.join(', ')}. Missing: ${missing.join(', ')}.` }]
  if (!/\bgood example\b/i.test(method))
    return [{ code: 'method-without-examples', message: 'Under Sections, give at least one "Good example:" (and a "Bad example:" where a common mistake exists).' }]
  return []
}

export function validateTemplate(content: unknown, opts: { requireSkeleton?: boolean; workItemType?: WorkItemType } = {}): Validation {
  if (!isContent(content))
    return {
      ok: false,
      reasons: [
        {
          code: 'malformed-template',
          message:
            'Expected { "name": string, "sections": [{ "key", "heading", "shape": "prose"|"entries", "locked": boolean, "guidance", "target", "entryFormat"?: "gherkin" }], "method": string }.',
        },
      ],
    }

  const reasons: Reason[] = []
  const type = opts.workItemType ?? content.workItemType
  const knownType = isWorkItemType(type)
  if (!knownType) reasons.push({ code: 'unknown-work-item-type', message: `The Template needs a Work Item Type: one of ${WORK_ITEM_TYPES.join(', ')}.` })
  const targets: string[] = knownType ? allowedTargets(type) : []
  const fieldNames = targets.map((t) => ADO_FIELD_LABELS[t]).join(', ')
  if (!content.name.trim()) reasons.push({ code: 'missing-name', message: 'The Template needs a name.' })
  if (!content.sections.length) reasons.push({ code: 'no-sections', message: 'A Template needs at least one Section.' })

  const seen = new Set<string>()
  for (const s of content.sections) {
    const at = { sectionKey: s.key }
    if (!KEY.test(s.key)) {
      reasons.push({ code: 'bad-key', ...at, message: `Section key "${s.key}" must be letters and digits, starting with a letter (e.g. "openQuestions").` })
      continue
    }
    if (seen.has(s.key)) {
      reasons.push({ code: 'duplicate-key', ...at, message: `Section key "${s.key}" is used twice.` })
      continue
    }
    seen.add(s.key)
    if (!s.heading.trim()) reasons.push({ code: 'missing-heading', ...at, message: `Section "${s.key}" needs a heading.` })
    if (s.shape !== 'prose' && s.shape !== 'entries') reasons.push({ code: 'bad-shape', ...at, message: `Section "${s.key}": shape must be "prose" or "entries".` })
    else if (s.entryFormat === 'gherkin' && s.shape !== 'entries')
      reasons.push({ code: 'gherkin-on-prose', ...at, message: `Section "${s.key}": Given / When / Then applies only to entries Sections.` })
    if (knownType && !targets.includes(s.target)) reasons.push({ code: 'unknown-target', ...at, message: `Section "${s.key}": a ${type} can be Published only into ${fieldNames}.` })
    if (typeof s.locked !== 'boolean') reasons.push({ code: 'bad-locked', ...at, message: `Section "${s.key}": locked must be true or false.` })
  }

  if (knownType && content.iterationLogTarget !== undefined && !targets.includes(content.iterationLogTarget))
    reasons.push({ code: 'unknown-iteration-log-target', message: `The Iteration Log of a ${type} can be Published only into ${fieldNames}.` })

  if (!content.method.trim()) reasons.push({ code: 'missing-method', message: 'The Template needs a writing method.' })
  else if (opts.requireSkeleton) reasons.push(...skeletonReasons(content.method))
  return reasons.length ? { ok: false, reasons } : { ok: true }
}
