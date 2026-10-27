// Tells the reader what Claude knew when this session started: a Continuation, or a fresh start, and the Prototypes
// it was given.
import { GivenPrototypes } from '@/components/features/prototypes/givenPrototypes/givenPrototypes'
import type { AnyTranscript } from '@/types/chat'

/** The Prototypes the session was given, when it was given any. */
function Given({ transcript }: Readonly<{ transcript: AnyTranscript }>) {
  const { projectId, prototypeIds } = transcript
  // A Prototype Grilling Session's own `prototypeIds` are the Prototypes it wrote, not ones it was given.
  if (transcript.kind === 'prototypeGrilling' || !projectId || !prototypeIds?.length) return null
  return <GivenPrototypes projectId={projectId} prototypeIds={prototypeIds} />
}

/** Tells the reader what Claude knew when this session started: a Continuation, or a fresh start. */
export function SessionOrigin({ transcript, first }: Readonly<{ transcript: AnyTranscript; first: boolean }>) {
  if (transcript.continues)
    return (
      <>
        <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
          Claude continues an earlier conversation, with the current Draft in hand.
        </p>
        <Given transcript={transcript} />
      </>
    )
  if (first) return <Given transcript={transcript} />
  return (
    <>
      <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
        Claude started fresh from the current Draft — it doesn’t see the chat above.
      </p>
      <Given transcript={transcript} />
    </>
  )
}
