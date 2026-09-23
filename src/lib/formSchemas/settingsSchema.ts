import { z } from 'zod'

export const settingsSchema = z.object({
  author: z.string().trim().min(1, 'Used in Iteration Log lines, e.g. @dorijan'),
  model: z.string().trim(),
})
export type SettingsFormData = z.infer<typeof settingsSchema>
