// Validation for the Template editor, including the per-Tracker and per-type rules on which fields Sections
// may use. Jira Templates may also name Custom Fields, which the editor keeps as a list of names.
import { z } from 'zod'

import { TRACKERS } from '#core/shared/tracker.ts'
import { customFieldName, fieldLabel, isCustomFieldTarget, JIRA_FIELDS } from '#core/shared/trackerFields.ts'
import { acceptsCustomFields, allowedTargets, WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

const SECTION_KEY = /^[A-Za-z]\w*$/ // a letter, then letters, digits or underscores

/** Jira's own field names, lower-cased; a Custom Field may not take one. */
const JIRA_SYSTEM_NAMES = Object.values(JIRA_FIELDS).map((field) => fieldLabel(field).toLowerCase())

export const templateSectionSchema = z.object({
  key: z.string().trim().regex(SECTION_KEY, 'Letters and digits, starting with a letter'),
  heading: z.string().trim().min(1, 'Give the Section a heading'),
  shape: z.enum(['prose', 'entries']),
  locked: z.boolean(),
  guidance: z.string().trim(),
  /** Which fields a Template may use depends on its Tracker and type, checked below. */
  target: z.string(),
  gherkin: z.boolean(),
})

export const templateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the Template'),
    tracker: z.enum(TRACKERS),
    workItemType: z.enum(WORK_ITEM_TYPES),
    iterationLogHeading: z.string().trim().min(1, 'Name the Iteration Log heading'),
    iterationLogTarget: z.string(),
    /** The Custom Fields this Jira Template's Sections can be copied into. */
    customFields: z.array(z.string().trim().min(1, 'Name the Custom Field')),
    method: z.string().trim().min(1, 'Describe how Claude should write'),
    sections: z.array(templateSectionSchema).min(1, 'A Template needs at least one Section'),
  })
  .superRefine((template, ctx) => {
    const system: string[] = allowedTargets(template.tracker, template.workItemType)
    const customs = acceptsCustomFields(template.tracker) ? template.customFields : []
    const allowed = (target: string) =>
      system.includes(target) || (isCustomFieldTarget(target) && customs.includes(customFieldName(target)))
    const notAllowed = `A ${template.workItemType} can't be copied into this field`

    template.customFields.forEach((name, i) => {
      const lower = name.trim().toLowerCase()
      const repeated = template.customFields.findIndex((other) => other.trim().toLowerCase() === lower) !== i
      if (JIRA_SYSTEM_NAMES.includes(lower) || repeated)
        ctx.addIssue({ code: 'custom', path: ['customFields', i], message: 'Use a name no other field has' })
    })
    if (!allowed(template.iterationLogTarget))
      ctx.addIssue({ code: 'custom', path: ['iterationLogTarget'], message: notAllowed })
    const seen = new Set<string>()
    template.sections.forEach((section, i) => {
      if (seen.has(section.key))
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'key'], message: 'Each key must be unique' })
      seen.add(section.key)
      if (!allowed(section.target))
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'target'], message: notAllowed })
    })
  })

export type TemplateFormData = z.infer<typeof templateSchema>
