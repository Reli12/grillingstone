// The message box when no session is running: the first words of a new session, or of a Continuation.
import { type KeyboardEvent, useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { CornerDownRight, X } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'
import { type MessageFormData, messageSchema } from '@/lib/formSchemas/messageSchema'

interface Continuing {
  label: string
  onCancel: () => void
}

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

/** Enter sends; Shift+Enter keeps a new line; Enter that confirms an IME composition does neither. */
function sendOnEnter(send: () => Promise<void>) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }
}

interface ContinueChoiceProps {
  continuing?: Continuing
  onContinueLatest?: () => void
  blocked: boolean
}

/** Above the box: either "Continuing …" with a way back, or the offer to continue the latest session. */
function ContinueChoice({ continuing, onContinueLatest, blocked }: Readonly<ContinueChoiceProps>) {
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

interface StartRowProps {
  hint?: string
  starting: boolean
  canSend: boolean
  onSend: () => void
}

/** Under the box: the hint, and Send (which reads "Starting…" while the session spins up). */
function StartRow({ hint, starting, canSend, onSend }: Readonly<StartRowProps>) {
  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      {hint && <span className="pl-1 text-[13px] text-ink-faint">{hint}</span>}
      <span className="ml-auto" />
      <Button size="sm" variant="claude" disabled={!canSend} onClick={onSend}>
        {starting ? 'Starting…' : 'Send'}
      </Button>
    </div>
  )
}

interface StartFormOptions {
  disabled: boolean
  onStart: (text: string) => void
  continuingLabel?: string
}

/** The message form: sends trimmed, non-blank text unless disabled, then clears the box. */
function useStartForm({ disabled, onStart, continuingLabel }: StartFormOptions) {
  const { register, handleSubmit, reset, setFocus, formState } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    mode: 'onChange',
    defaultValues: { text: '' },
  })

  // Choosing to continue a session moves the cursor into the box, ready for the first words.
  useEffect(() => {
    if (continuingLabel) setFocus('text')
  }, [continuingLabel, setFocus])

  const send = handleSubmit(({ text }) => {
    if (disabled) return
    onStart(text)
    reset()
  })
  return { register, send, canSend: !disabled && formState.isValid }
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
