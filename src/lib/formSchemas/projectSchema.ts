// Validation for a Project's name, and for the New Project dialog.
import { z } from 'zod'

export const projectNameSchema = z.object({
  name: z.string().trim().min(1, 'Name the Project'),
})
export type ProjectNameFormData = z.infer<typeof projectNameSchema>

export const newProjectSchema = projectNameSchema.extend({
  /** Where the Glossary starts from: empty, text the human brings, or a copy of another Project's. */
  source: z.enum(['empty', 'paste', 'copy']),
  copyFrom: z.string(),
  /** The starting Glossary below its title; the title is always the Project name. */
  body: z.string(),
})
export type NewProjectFormData = z.infer<typeof newProjectSchema>
