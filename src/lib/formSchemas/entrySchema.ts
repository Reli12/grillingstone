import { z } from 'zod'

/** A new Entry added by hand to an entries Section. */
export const entrySchema = z.object({
  title: z.string().trim().min(1, 'Give the Entry a title'),
  body: z.string().trim().min(1, 'Write the Entry'),
})
export type EntryFormData = z.infer<typeof entrySchema>
