// Validation for the New Draft form.
import { z } from 'zod'

import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

const pastedCopy = z.object({
  workItem: z.string(),
  workItemType: z.string(),
  title: z.string(),
  content: z.string(),
  acceptanceCriteria: z.string().optional(),
})

export const newDraftSchema = z
  .object({
    workItemType: z.enum(WORK_ITEM_TYPES),
    /** '' = the type's Default Template. */
    templateId: z.string(),
    requirement: z.string().trim(),
    references: z.array(z.string()),
    /** Existing Backlog Copies to reference (Azure DevOps Projects only). */
    backlogReferences: z.array(z.string()),
    /** Backlog Copies pasted in the form, created together with the Draft. */
    newBacklogCopies: z.array(pastedCopy),
  })
  // With a Backlog Reference the first session can start from the referenced item, so the requirement is optional.
  .refine(
    (form) =>
      form.requirement.trim().length > 0 || form.backlogReferences.length > 0 || form.newBacklogCopies.length > 0,
    { message: 'Describe the requirement', path: ['requirement'] },
  )
export type NewDraftFormData = z.infer<typeof newDraftSchema>
