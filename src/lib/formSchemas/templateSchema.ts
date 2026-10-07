import { z } from 'zod'

import { SECTION_TARGETS } from '#core/shared/adoFields.ts'
import { allowedTargets, WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

/** Every field a Section of some type may target; which ones a Template may use depends on its type. */
const target = z.enum(SECTION_TARGETS)

export const templateSectionSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Za-z]\w*$/, 'Letters and digits, starting with a letter'),
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
    method: z.string().trim().min(1, 'Describe how Claude should write'),
    sections: z.array(templateSectionSchema).min(1, 'A Template needs at least one Section'),
  })
  .superRefine((t, ctx) => {
    const allowed: string[] = allowedTargets(t.workItemType)
    const notAllowed = `A ${t.workItemType} can't be Published into this field`
    if (!allowed.includes(t.iterationLogTarget))
      ctx.addIssue({ code: 'custom', path: ['iterationLogTarget'], message: notAllowed })
    const seen = new Set<string>()
    t.sections.forEach((s, i) => {
      if (seen.has(s.key))
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'key'], message: 'Each key must be unique' })
      seen.add(s.key)
      if (!allowed.includes(s.target))
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'target'], message: notAllowed })
    })
  })

export type TemplateFormData = z.infer<typeof templateSchema>
