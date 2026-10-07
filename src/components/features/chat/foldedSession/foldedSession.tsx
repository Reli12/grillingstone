// A finished session folded into one line; clicking it opens the read-only Transcript.
import { type ReactNode } from 'react'

import { ChevronRight } from 'lucide-react'

import { SessionHeading } from '@/components/features/chat/sessionHeading/sessionHeading'
import type { AnyTranscript } from '@/types/chat'

interface FoldedSessionProps {
  transcript: AnyTranscript
  continueButton: ReactNode
  onOpen: () => void
}

/** A finished session folded into one line; clicking it opens the read-only Transcript. */
export function FoldedSession({ transcript, continueButton, onOpen }: Readonly<FoldedSessionProps>) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-line-soft bg-sheet/60 pr-1.5 hover:border-line">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[13px]">
        <ChevronRight size={14} className="shrink-0 text-ink-faint" />
        <span className="truncate">
          <SessionHeading transcript={transcript} />
        </span>
        <span className="ml-auto shrink-0 text-ink-faint">Read transcript</span>
      </button>
      {continueButton}
    </div>
  )
}
