import { z } from 'zod'

export const glossaryTermSchema = z.object({
  term: z.string().trim().min(1, 'Name the term'),
  definition: z.string().trim(),
  avoid: z.string().trim(),
})
export type GlossaryTermFormData = z.infer<typeof glossaryTermSchema>
