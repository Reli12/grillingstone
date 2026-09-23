import { z } from 'zod'

/** Anything the human types to Claude: a chat message or a free-text answer. */
export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Type a message'),
})
export type MessageFormData = z.infer<typeof messageSchema>
