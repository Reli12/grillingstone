// The message box when no session is running: the first words of a new session, or of a Continuation.

import { ContinueChoice } from '@/components/features/chat/continueChoice/continueChoice'
import { StartRow } from '@/components/features/chat/startRow/startRow'
import { useStartForm } from '@/hooks/chat/useStartForm'
import { cn } from '@/lib/cn'
import { sendOnEnter } from '@/lib/sendOnEnter'
import type { Continuing } from '@/types/chat'

interface NewSessionComposerProps {
  placeholder: string
  /** Shown under the box. */
  hint?: string
  /** When set, the box is disabled and says why. */
  blockedReason?: string
  starting: boolean
  onStart: (text: string) => void
  /** Set while the human chose to continue an ended session instead: what it is, and how to go back. */
  continuing?: Continuing
  /** Offers to continue the latest ended session instead of starting a new one. */
  onContinueLatest?: () => void
}

/**
 * The message box when no session is running: sending starts a new session with the message as its first
 * words, or continues the ended one the human picked. Either way Claude gets the current Draft.
 */
export function NewSessionComposer({
  placeholder,
  hint,
  blockedReason,
  starting,
  onStart,
  continuing,
  onContinueLatest,
}: Readonly<NewSessionComposerProps>) {
  const blocked = !!blockedReason
  const disabled = blocked || starting
  const { register, send, canSend } = useStartForm({ disabled, onStart, continuingLabel: continuing?.label })

  return (
    <div className="shrink-0 border-t border-line bg-sheet">
      <div className="mx-auto max-w-[720px] px-4 py-3">
        <ContinueChoice continuing={continuing} onContinueLatest={onContinueLatest} blocked={blocked} />
        <div
          className={cn(
            'rounded-lg border bg-sheet transition-colors',
            disabled ? 'border-line-soft' : 'border-line focus-within:border-claude',
          )}
        >
          <textarea
            rows={2}
            {...register('text')}
            disabled={disabled}
            onKeyDown={sendOnEnter(send)}
            placeholder={blockedReason ?? placeholder}
            aria-label="Message Claude"
            className="block max-h-48 w-full resize-none bg-transparent px-3 pt-2.5 text-[15px] placeholder:text-ink-faint focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <StartRow hint={blocked ? undefined : hint} starting={starting} canSend={canSend} onSend={send} />
        </div>
      </div>
    </div>
  )
}
