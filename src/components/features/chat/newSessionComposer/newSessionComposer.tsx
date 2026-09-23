import { useEffect, type KeyboardEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { CornerDownRight, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'
import { messageSchema, type MessageFormData } from '@/lib/formSchemas/messageSchema'

interface Props {
  placeholder: string
  /** Shown under the box. */
  hint?: string
  /** When set, the box is disabled and says why. */
  blockedReason?: string
  starting: boolean
  onStart: (text: string) => void
  /** Set while the human chose to continue an ended session instead: what it is, and how to go back. */
  continuing?: { label: string; onCancel: () => void }
  /** Offers to continue the latest ended session instead of starting a new one. */
  onContinueLatest?: () => void
}

/**
 * The message box when no session is running: sending starts a new session with the message as its first
 * words, or continues the ended one the human picked. Either way Claude gets the current Draft.
 */
export function NewSessionComposer({ placeholder, hint, blockedReason, starting, onStart, continuing, onContinueLatest }: Props) {
  const { register, handleSubmit, reset, setFocus, formState } = useForm<MessageFormData>({ resolver: zodResolver(messageSchema), mode: 'onChange', defaultValues: { text: '' } })

  const continuingLabel = continuing?.label
  useEffect(() => {
    if (continuingLabel) setFocus('text')
  }, [continuingLabel, setFocus])

  const disabled = !!blockedReason || starting

  const send = handleSubmit(({ text }) => {
    if (disabled) return
    onStart(text)
    reset()
  })
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="shrink-0 border-t border-line bg-sheet">
      <div className="mx-auto max-w-[720px] px-4 py-3">
        {continuing ? (
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-claude">
            <span className="truncate">Continuing {continuing.label}</span>
            <button onClick={continuing.onCancel} aria-label="Start a new session instead" className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-fog-deep hover:text-ink">
              <X size={13} />
            </button>
          </p>
        ) : (
          onContinueLatest &&
          !blockedReason && (
            <button
              onClick={onContinueLatest}
              aria-label="Continue this session instead"
              className="mb-2 flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] font-medium text-claude hover:bg-fog-deep"
            >
              <CornerDownRight size={13} /> Continue last session instead of starting a new one
            </button>
          )
        )}
        <div className={cn('rounded-lg border bg-sheet transition-colors', disabled ? 'border-line-soft' : 'border-line focus-within:border-claude')}>
          <textarea
            rows={2}
            {...register('text')}
            disabled={disabled}
            onKeyDown={onKeyDown}
            placeholder={blockedReason ?? placeholder}
            aria-label="Message Claude"
            className="block max-h-48 w-full resize-none bg-transparent px-3 pt-2.5 text-[15px] placeholder:text-ink-faint focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            {hint && !blockedReason && <span className="pl-1 text-[13px] text-ink-faint">{hint}</span>}
            <span className="ml-auto" />
            <Button size="sm" variant="claude" disabled={disabled || !formState.isValid} onClick={send}>
              {starting ? 'Starting…' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
