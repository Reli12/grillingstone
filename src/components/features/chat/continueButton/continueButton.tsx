// The Continue button on an ended session in the chat thread.
import { CornerDownRight } from 'lucide-react'

import { SESSION_TITLES } from '@/constants/SessionConstants'
import type { AnyTranscript } from '@/types/chat'

interface ContinueButtonProps {
  transcript: AnyTranscript
  onContinue: (sessionId: string) => void
}

export function ContinueButton({ transcript, onContinue }: Readonly<ContinueButtonProps>) {
  return (
    <button
      onClick={() => onContinue(transcript.id)}
      aria-label={`Continue ${SESSION_TITLES[transcript.kind]}`}
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-claude hover:bg-fog-deep"
    >
      <CornerDownRight size={13} /> Continue
    </button>
  )
}
