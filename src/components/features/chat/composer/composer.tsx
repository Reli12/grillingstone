import { forwardRef, type KeyboardEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Square } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { SessionBase } from '#core/session/sessionTypes.ts'
import { Button } from '@/components/atoms/button/button'
import { writeTarget } from '@/constants/SessionConstants'
import { cn } from '@/lib/cn'
import { messageSchema, type MessageFormData } from '@/lib/formSchemas/messageSchema'

interface Props {
  session: SessionBase
  sending: boolean
  onSend: (text: string) => void
  onWriteNow: () => void
  onStop: () => void
}

/** The message box for a running session, with "Enough — write it" always at hand. */
export const Composer = forwardRef<HTMLTextAreaElement, Props>(function Composer({ session, sending, onSend, onWriteNow, onStop }, ref) {
  const { register, handleSubmit, reset, formState } = useForm<MessageFormData>({ resolver: zodResolver(messageSchema), mode: 'onChange', defaultValues: { text: '' } })

  const yourTurn = session.status === 'waiting'
  const { ref: fieldRef, ...field } = register('text')

  const send = handleSubmit(({ text }) => {
    if (!yourTurn) return
    onSend(text)
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
        <div className={cn('rounded-lg border bg-sheet transition-colors', yourTurn ? 'border-line focus-within:border-claude' : 'border-line-soft')}>
          <textarea
            {...field}
            ref={(el) => {
              fieldRef(el)
              if (typeof ref === 'function') ref(el)
              else if (ref) ref.current = el
            }}
            rows={2}
            onKeyDown={onKeyDown}
            placeholder={yourTurn ? 'Answer, add context, or push back…' : 'Claude is replying…'}
            aria-label="Message Claude"
            className="block max-h-48 w-full resize-none bg-transparent px-3 pt-2.5 text-[15px] placeholder:text-ink-faint focus:outline-none focus-visible:outline-none"
          />
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
            <Button size="sm" variant="ink" disabled={!yourTurn || !formState.isValid || sending} onClick={send}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})
