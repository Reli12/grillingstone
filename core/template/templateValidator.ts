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

// A Section key: a letter, then letters, digits or underscores.
const KEY = /^[A-Za-z]\w*$/
// The words "good example" anywhere in the method.
const GOOD_EXAMPLE = /\bgood example\b/i

const MALFORMED_TEMPLATE_MESSAGE =
  'Expected { "name": string, "sections": [{ "key", "heading", "shape": "prose"|"entries", "locked": boolean, "guidance", "target", "entryFormat"?: "gherkin" }], "method": string }.'

const isSectionShape = (section: unknown): boolean => {
  if (!section || typeof section !== 'object') return false
  const { key, heading } = section as Record<string, unknown>
  return typeof key === 'string' && typeof heading === 'string'
}

const isContent = (content: unknown): content is TemplateContent => {
  if (!content || typeof content !== 'object') return false
  const { name, sections, method } = content as Record<string, unknown>
  return (
    typeof name === 'string' &&
    typeof method === 'string' &&
    Array.isArray(sections) &&
    (sections as unknown[]).every(isSectionShape)
  )
}

/** The parts every method written by a Template Session must have, as markdown headings, in this order. */
export const SKELETON_PARTS = ['Purpose', 'Guiding principle', 'Sections', 'Working process'] as const

/** A markdown heading (# to ####) naming `part`, optionally numbered ("## 2. Sections"). */
const hasHeading = (method: string, part: string) =>
  new RegExp(`^#{1,4}\\s+(\\d+[.)]\\s*)?${part}\\b`, 'im').test(method)

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
  const missing = SKELETON_PARTS.filter((part) => !hasHeading(method, part))
  if (missing.length)
    return [
      {
        code: 'method-missing-part',
        message: `The method must have these markdown headings: ${SKELETON_PARTS.join(', ')}. Missing: ${missing.join(', ')}.`,
      },
    ]
  if (!GOOD_EXAMPLE.test(method))
    return [
      {
        code: 'method-without-examples',
        message:
          'Under Sections, give at least one "Good example:" (and a "Bad example:" where a common mistake exists).',
      },
    ]
  return []
}

/** Which Azure DevOps fields Sections may target; `known` is false when the Work Item Type is unknown. */
interface TargetRule {
  known: boolean
  type: unknown
  targets: string[]
  fieldNames: string
}

/** The checks for one Section whose key is valid and not a duplicate. */
function checkTemplateSection(section: TemplateSection, rule: TargetRule): Reason[] {
  const at = { sectionKey: section.key }
  const reasons: Reason[] = []
  if (!section.heading.trim())
    reasons.push({ code: 'missing-heading', ...at, message: `Section "${section.key}" needs a heading.` })
  if (section.shape !== 'prose' && section.shape !== 'entries')
    reasons.push({ code: 'bad-shape', ...at, message: `Section "${section.key}": shape must be "prose" or "entries".` })
  else if (section.entryFormat === 'gherkin' && section.shape !== 'entries')
    reasons.push({
      code: 'gherkin-on-prose',
      ...at,
      message: `Section "${section.key}": Given / When / Then applies only to entries Sections.`,
    })
  if (rule.known && !rule.targets.includes(section.target))
    reasons.push({
      code: 'unknown-target',
      ...at,
      message: `Section "${section.key}": a ${String(rule.type)} can be Published only into ${rule.fieldNames}.`,
    })
  if (typeof section.locked !== 'boolean')
    reasons.push({ code: 'bad-locked', ...at, message: `Section "${section.key}": locked must be true or false.` })
  return reasons
}

/** Checks every Section: a bad or repeated key stops that Section's other checks. */
function checkTemplateSections(sections: TemplateSection[], rule: TargetRule): Reason[] {
  const reasons: Reason[] = []
  const seen = new Set<string>()
  for (const section of sections) {
    const at = { sectionKey: section.key }
    if (!KEY.test(section.key)) {
      reasons.push({
        code: 'bad-key',
        ...at,
        message: `Section key "${section.key}" must be letters and digits, starting with a letter (e.g. "openQuestions").`,
      })
      continue
    }
    if (seen.has(section.key)) {
      reasons.push({ code: 'duplicate-key', ...at, message: `Section key "${section.key}" is used twice.` })
      continue
    }
    seen.add(section.key)
    reasons.push(...checkTemplateSection(section, rule))
  }
  return reasons
}

export function validateTemplate(
  content: unknown,
  opts: { requireSkeleton?: boolean; workItemType?: WorkItemType } = {},
): Validation {
  if (!isContent(content))
    return { ok: false, reasons: [{ code: 'malformed-template', message: MALFORMED_TEMPLATE_MESSAGE }] }

  const reasons: Reason[] = []
  const type = opts.workItemType ?? content.workItemType
  const knownType = isWorkItemType(type)
  if (!knownType)
    reasons.push({
      code: 'unknown-work-item-type',
      message: `The Template needs a Work Item Type: one of ${WORK_ITEM_TYPES.join(', ')}.`,
    })
  const targets: string[] = knownType ? allowedTargets(type) : []
  const fieldNames = targets.map((target) => ADO_FIELD_LABELS[target]).join(', ')
  if (!content.name.trim()) reasons.push({ code: 'missing-name', message: 'The Template needs a name.' })
  if (!content.sections.length) reasons.push({ code: 'no-sections', message: 'A Template needs at least one Section.' })

  reasons.push(...checkTemplateSections(content.sections, { known: knownType, type, targets, fieldNames }))

  const logTarget = content.iterationLogTarget
  if (knownType && logTarget !== undefined && !targets.includes(logTarget))
    reasons.push({
      code: 'unknown-iteration-log-target',
      message: `The Iteration Log of a ${type} can be Published only into ${fieldNames}.`,
    })

  if (!content.method.trim()) reasons.push({ code: 'missing-method', message: 'The Template needs a writing method.' })
  else if (opts.requireSkeleton) reasons.push(...skeletonReasons(content.method))
  return reasons.length ? { ok: false, reasons } : { ok: true }
}
