// One session of the thread: folded into a line, or open with its messages.
import { ContinueButton } from '@/components/features/chat/continueButton/continueButton'
import { ExpandedSession } from '@/components/features/chat/expandedSession/expandedSession'
import { FoldedSession } from '@/components/features/chat/foldedSession/foldedSession'
import type { AnyTranscript, ContinueOptions, Handlers } from '@/types/chat'

interface ThreadSessionProps extends ContinueOptions {
  transcript: AnyTranscript
  expanded: boolean
  first: boolean
  live: boolean
  onOpen: () => void
  handlers: Handlers
}

/** One session of the thread: folded into a line, or open with its messages. */
export function ThreadSession({
  transcript,
  expanded,
  first,
  live,
  onOpen,
  canContinue,
  continueBlockedReason,
  onContinue,
  handlers,
}: Readonly<ThreadSessionProps>) {
  const offerContinue = onContinue && canContinue?.(transcript)
  const blockedReason = onContinue && !offerContinue ? continueBlockedReason?.(transcript) : undefined
  const continueButton =
    offerContinue || blockedReason ? (
      <ContinueButton transcript={transcript} onContinue={onContinue!} blockedReason={blockedReason} />
    ) : null
  if (!expanded) return <FoldedSession transcript={transcript} continueButton={continueButton} onOpen={onOpen} />
  return (
    <ExpandedSession
      transcript={transcript}
      first={first}
      live={live}
      continueButton={continueButton}
      handlers={handlers}
    />
  )
}
