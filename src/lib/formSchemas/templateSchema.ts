// Validation for the Template editor, including the per-type rules on which ADO fields Sections may use.
import { z } from 'zod'

import { SECTION_TARGETS } from '#core/shared/adoFields.ts'
import { allowedTargets, WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

const SECTION_KEY = /^[A-Za-z]\w*$/ // a letter, then letters, digits or underscores

/** Every field a Section of some type may target; which ones a Template may use depends on its type. */
const target = z.enum(SECTION_TARGETS)

export const templateSectionSchema = z.object({
  key: z.string().trim().regex(SECTION_KEY, 'Letters and digits, starting with a letter'),
  heading: z.string().trim().min(1, 'Give the Section a heading'),
  shape: z.enum(['prose', 'entries']),
  locked: z.boolean(),
  guidance: z.string().trim(),
  target,
  gherkin: z.boolean(),
})

export const templateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the Template'),
    workItemType: z.enum(WORK_ITEM_TYPES),
    iterationLogHeading: z.string().trim().min(1, 'Name the Iteration Log heading'),
    iterationLogTarget: target,
    method: z.string().trim().min(1, 'Describe how the Sections should be written'),
    sections: z.array(templateSectionSchema).min(1, 'A Template needs at least one Section'),
  })
  .superRefine((template, ctx) => {
    const allowed: string[] = allowedTargets(template.workItemType)
    const notAllowed = `A ${template.workItemType} can't be Published into this field`
    if (!allowed.includes(template.iterationLogTarget))
      ctx.addIssue({ code: 'custom', path: ['iterationLogTarget'], message: notAllowed })
    const seen = new Set<string>()
    template.sections.forEach((section, i) => {
      if (seen.has(section.key))
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'key'], message: 'Each key must be unique' })
      seen.add(section.key)
      if (!allowed.includes(section.target))
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'target'], message: notAllowed })
    })
  })

export type TemplateFormData = z.infer<typeof templateSchema>
