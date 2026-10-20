// Validation for a message or answer typed to the Assistant.
import { z } from 'zod'

/** Anything the human types to the Assistant: a chat message or a free-text answer. */
export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Type a message'),
})
export type MessageFormData = z.infer<typeof messageSchema>
