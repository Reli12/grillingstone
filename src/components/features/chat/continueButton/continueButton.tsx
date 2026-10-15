// The Continue button on an ended session in the chat thread; shown disabled, with the reason, when it can't be used.
import { CornerDownRight } from 'lucide-react'

import { SESSION_TITLES } from '@/constants/SessionConstants'
import type { AnyTranscript } from '@/types/chat'

interface ContinueButtonProps {
  transcript: AnyTranscript
  onContinue: (sessionId: string) => void
  /** Set when the session cannot be continued now; the button stays visible to say why. */
  blockedReason?: string
}

export function ContinueButton({ transcript, onContinue, blockedReason }: Readonly<ContinueButtonProps>) {
  return (
    <button
      onClick={() => onContinue(transcript.id)}
      disabled={!!blockedReason}
      title={blockedReason}
      aria-label={`Continue ${SESSION_TITLES[transcript.kind]}`}
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-claude hover:bg-fog-deep disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent"
    >
      <CornerDownRight size={13} /> Continue
    </button>
  )
}
