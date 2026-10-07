// Above the box: either "Continuing …" with a way back, or the offer to continue the latest session.
import { CornerDownRight, X } from 'lucide-react'

import type { Continuing } from '@/types/chat'

interface ContinueChoiceProps {
  continuing?: Continuing
  onContinueLatest?: () => void
  blocked: boolean
}

/** Above the box: either "Continuing …" with a way back, or the offer to continue the latest session. */
export function ContinueChoice({ continuing, onContinueLatest, blocked }: Readonly<ContinueChoiceProps>) {
  if (continuing)
    return (
      <p className="mb-2 flex items-center gap-1.5 text-[13px] text-claude">
        <span className="truncate">Continuing {continuing.label}</span>
        <button
          onClick={continuing.onCancel}
          aria-label="Start a new session instead"
          className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-fog-deep hover:text-ink"
        >
          <X size={13} />
        </button>
      </p>
    )
  if (!onContinueLatest || blocked) return null
  return (
    <button
      onClick={onContinueLatest}
      aria-label="Continue this session instead"
      className="mb-2 flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] font-medium text-claude hover:bg-fog-deep"
    >
      <CornerDownRight size={13} /> Continue last session instead of starting a new one
    </button>
  )
}
