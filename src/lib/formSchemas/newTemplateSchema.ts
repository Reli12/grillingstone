// Validation for the New Template start step, and the stricter rule for grilling a Template.
import { z } from 'zod'

import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

export const newTemplateSchema = z.object({
  workItemType: z.enum(WORK_ITEM_TYPES),
  /** '' = start from nothing. */
  baseId: z.string(),
  purpose: z.string().trim(),
  examples: z.string().trim(),
})
export type NewTemplateFormData = z.infer<typeof newTemplateSchema>

/** Grilling needs a purpose to start from; building by hand does not. */
export const templateSessionSchema = newTemplateSchema.extend({
  purpose: z.string().trim().min(1, 'Describe what the Template is for'),
})
