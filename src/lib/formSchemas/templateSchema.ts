import { z } from 'zod'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

export const templateSectionSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Letters and digits, starting with a letter'),
  heading: z.string().trim().min(1, 'Give the Section a heading'),
  shape: z.enum(['prose', 'entries']),
  locked: z.boolean(),
  guidance: z.string().trim(),
  target: z.enum([ADO_FIELDS.description, ADO_FIELDS.acceptanceCriteria]),
  gherkin: z.boolean(),
})

export const templateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the Template'),
    workItemType: z.enum(WORK_ITEM_TYPES as ['Epic', 'Feature', 'PBI']),
    iterationLogHeading: z.string().trim().min(1, 'Name the Iteration Log heading'),
    method: z.string().trim().min(1, 'Describe how Claude should write'),
    sections: z.array(templateSectionSchema).min(1, 'A Template needs at least one Section'),
  })
  .superRefine((t, ctx) => {
    const seen = new Set<string>()
    t.sections.forEach((s, i) => {
      if (seen.has(s.key)) ctx.addIssue({ code: 'custom', path: ['sections', i, 'key'], message: 'Each key must be unique' })
      seen.add(s.key)
    })
  })

export type TemplateFormData = z.infer<typeof templateSchema>
