// Validation for a message or answer typed to Claude.
import { z } from 'zod'

/** Anything the human types to Claude: a chat message or a free-text answer. */
export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Type a message'),
})
export type MessageFormData = z.infer<typeof messageSchema>

/**
 * The message box under a session: words may be empty because Images alone are a valid message. Whether
 * there is anything to send (words or at least one Image) is decided where the Images are known.
 */
export const imageMessageSchema = z.object({ text: z.string().trim() })
