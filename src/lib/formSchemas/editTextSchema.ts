import { z } from 'zod'

/** In-place edit of Draft text: the body, plus the title for an Entry. */
export const editTextSchema = z.object({
  body: z.string().trim().min(1, 'Text cannot be empty'),
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
})
export type EditTextFormData = z.infer<typeof editTextSchema>
