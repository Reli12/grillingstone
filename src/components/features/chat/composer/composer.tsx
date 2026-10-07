// The message box under a running session: answer or push back, write now, or stop.
import { forwardRef } from 'react'
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import type { SessionBase } from '#core/session/sessionTypes.ts'

import { ComposerActions } from '@/components/features/chat/composerActions/composerActions'
import { ComposerFrame } from '@/components/features/chat/composerFrame/composerFrame'
import { bothRefs } from '@/lib/bothRefs'
import { type MessageFormData, messageSchema } from '@/lib/formSchemas/messageSchema'
import { sendOnEnter } from '@/lib/sendOnEnter'

interface ComposerProps {
  session: SessionBase
  sending: boolean
  onSend: (text: string) => void
  onWriteNow: () => void
  onStop: () => void
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
