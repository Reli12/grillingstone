// Tells the reader what the Assistant knew when this session started: a Continuation, or a fresh start.
import { ASSISTANT_LABELS } from '#core/session/assistantName.ts'

import type { AnyTranscript } from '@/types/chat'

/** Tells the reader what the Assistant knew when this session started: a Continuation, or a fresh start. */
export function SessionOrigin({ transcript, first }: Readonly<{ transcript: AnyTranscript; first: boolean }>) {
  const assistant = ASSISTANT_LABELS[transcript.assistant]
  if (transcript.continues)
    return (
      <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
        {assistant} continues an earlier conversation, with the current Draft in hand.
      </p>
    )
  if (first) return null
  return (
    <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
      {assistant} started fresh from the current Draft — it doesn’t see the chat above.
    </p>
  )
}
