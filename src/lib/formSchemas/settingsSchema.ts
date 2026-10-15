// Validation for the Settings form.
import { z } from 'zod'

export const settingsSchema = z.object({
  author: z.string().trim().min(1, 'Used in Iteration Log lines, e.g. @dorijan'),
  models: z.object({ claude: z.string().trim(), codex: z.string().trim() }),
})
export type SettingsFormData = z.infer<typeof settingsSchema>
