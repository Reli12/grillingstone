import { z } from 'zod'
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

export const newDraftSchema = z.object({
  workItemType: z.enum(WORK_ITEM_TYPES),
  /** '' = the type's Default Template. */
  templateId: z.string(),
  requirement: z.string().trim().min(1, 'Describe the requirement'),
  references: z.array(z.string()),
})
export type NewDraftFormData = z.infer<typeof newDraftSchema>
