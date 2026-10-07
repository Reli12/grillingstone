// Tells the reader what Claude knew when this session started: a Continuation, or a fresh start.
import type { AnyTranscript } from '@/types/chat'

/** Tells the reader what Claude knew when this session started: a Continuation, or a fresh start. */
export function SessionOrigin({ transcript, first }: Readonly<{ transcript: AnyTranscript; first: boolean }>) {
  if (transcript.continues)
    return (
      <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
        Claude continues an earlier conversation, with the current Draft in hand.
      </p>
    )
  if (first) return null
  return (
    <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
      Claude started fresh from the current Draft — it doesn’t see the chat above.
    </p>
  )
}
