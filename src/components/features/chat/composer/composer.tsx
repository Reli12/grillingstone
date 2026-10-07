// The message box under a running session: answer or push back, write now, or stop.
import { type ForwardedRef, forwardRef, type KeyboardEvent, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { Square } from 'lucide-react'

import type { SessionBase } from '#core/session/sessionTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { writeTarget } from '@/constants/SessionConstants'
import { cn } from '@/lib/cn'
import { type MessageFormData, messageSchema } from '@/lib/formSchemas/messageSchema'

interface ComposerProps {
  session: SessionBase
  sending: boolean
  onSend: (text: string) => void
  onWriteNow: () => void
  onStop: () => void
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

/** Hands the textarea both to React Hook Form and to the caller's forwarded ref. */
function bothRefs(fieldRef: (element: HTMLTextAreaElement | null) => void, ref: ForwardedRef<HTMLTextAreaElement>) {
  return (element: HTMLTextAreaElement | null) => {
    fieldRef(element)
    if (typeof ref === 'function') ref(element)
    else if (ref) ref.current = element
  }
}

interface ComposerFrameProps {
  /** Highlights the border while the box can be typed in. */
  active: boolean
  children: ReactNode
}

/** The bar pinned under the chat, holding the bordered message box. */
function ComposerFrame({ active, children }: Readonly<ComposerFrameProps>) {
  return (
    <div className="shrink-0 border-t border-line bg-sheet">
      <div className="mx-auto max-w-[720px] px-4 py-3">
        <div
          className={cn(
            'rounded-lg border bg-sheet transition-colors',
            active ? 'border-line focus-within:border-claude' : 'border-line-soft',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

interface ComposerActionsProps {
  session: SessionBase
  canSend: boolean
  onSend: () => void
  onWriteNow: () => void
  onStop: () => void
}

function ComposerActions({ session, canSend, onSend, onWriteNow, onStop }: Readonly<ComposerActionsProps>) {
  const yourTurn = session.status === 'waiting'
  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      <Button size="sm" variant="quiet" onClick={onStop} title="Stop this session — nothing is written">
        <Square size={12} /> Stop
      </Button>
      <span className="ml-auto" />
      <Button
        size="sm"
        variant="proof"
        disabled={!yourTurn || session.status === 'writing'}
        onClick={onWriteNow}
        title={`Stop here: Claude writes ${writeTarget(session.kind)} now and decides open points with its recommended defaults`}
      >
        Enough — write it
      </Button>
      <Button size="sm" variant="ink" disabled={!canSend} onClick={onSend}>
        Send
      </Button>
    </div>
  )
}

/** The message box for a running session, with "Enough — write it" always at hand. */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { session, sending, onSend, onWriteNow, onStop },
  ref,
) {
  const { register, handleSubmit, reset, formState } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    mode: 'onChange',
    defaultValues: { text: '' },
  })

  const yourTurn = session.status === 'waiting'
  const { ref: fieldRef, ...field } = register('text')

  const send = handleSubmit(({ text }) => {
    if (!yourTurn) return
    onSend(text)
    reset()
  })

  return (
    <ComposerFrame active={yourTurn}>
      <textarea
        {...field}
        ref={bothRefs(fieldRef, ref)}
        rows={2}
        onKeyDown={sendOnEnter(send)}
        placeholder={yourTurn ? 'Answer, add context, or push back…' : 'Claude is replying…'}
        aria-label="Message Claude"
        className="block max-h-48 w-full resize-none bg-transparent px-3 pt-2.5 text-[15px] placeholder:text-ink-faint focus:outline-none focus-visible:outline-none"
      />
      <ComposerActions
        session={session}
        canSend={yourTurn && formState.isValid && !sending}
        onSend={send}
        onWriteNow={onWriteNow}
        onStop={onStop}
      />
    </ComposerFrame>
  )
})
