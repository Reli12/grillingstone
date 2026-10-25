// The message box under a running session: answer or push back, add Images, write now, or stop.
import { forwardRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import type { ImageUpload } from '#core/session/images.ts'
import type { SessionBase } from '#core/session/sessionTypes.ts'

import { ComposerActions } from '@/components/features/chat/composerActions/composerActions'
import { ComposerFrame } from '@/components/features/chat/composerFrame/composerFrame'
import { ImageNotices } from '@/components/features/chat/imageNotices/imageNotices'
import { ImagePicker } from '@/components/features/chat/imagePicker/imagePicker'
import { ImageThumbnails } from '@/components/features/chat/imageThumbnails/imageThumbnails'
import { useImageAttachments } from '@/hooks/chat/useImageAttachments'
import { bothRefs } from '@/lib/bothRefs'
import { imageMessageSchema, type MessageFormData } from '@/lib/formSchemas/messageSchema'
import { sendOnEnter } from '@/lib/sendOnEnter'

interface ComposerProps {
  session: SessionBase
  sending: boolean
  /** `onSent` is called once the send has worked; only then do the Images leave the box. */
  onSend: (text: string, images: ImageUpload[], onSent: () => void) => void
  onWriteNow: () => void
  onStop: () => void
  /** Template Sessions take no Images; their box leaves out the button and ignores paste and drop. */
  allowImages?: boolean
}

/** The message box for a running session, with "Enough — write it" always at hand. */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { session, sending, onSend, onWriteNow, onStop, allowImages = true },
  ref,
) {
  const { register, handleSubmit, reset, control } = useForm<MessageFormData>({
    resolver: zodResolver(imageMessageSchema),
    mode: 'onChange',
    defaultValues: { text: '' },
  })
  const attachments = useImageAttachments(session.id)

  const yourTurn = session.status === 'waiting'
  const { ref: fieldRef, ...field } = register('text')
  const hasWords = useWatch({ control, name: 'text' }).trim().length > 0
  const hasSomething = hasWords || attachments.pending.length > 0

  const send = handleSubmit(({ text }) => {
    if (!yourTurn || !hasSomething) return
    const batch = attachments.batch()
    onSend(text, batch.uploads, () => attachments.markSent(batch))
    reset()
  })

  return (
    <ComposerFrame active={yourTurn}>
      {allowImages && <ImageThumbnails pending={attachments.pending} onRemove={attachments.remove} />}
      {allowImages && <ImageNotices attachments={attachments} />}
      <textarea
        {...field}
        {...(allowImages ? attachments.textareaProps : {})}
        ref={bothRefs(fieldRef, ref)}
        rows={2}
        onKeyDown={sendOnEnter(send)}
        placeholder={yourTurn ? 'Answer, add context, or push back…' : 'Claude is replying…'}
        aria-label="Message Claude"
        className="block max-h-48 w-full resize-none bg-transparent px-3 pt-2.5 text-[15px] placeholder:text-ink-faint focus:outline-none focus-visible:outline-none"
      />
      <ComposerActions
        session={session}
        canSend={yourTurn && hasSomething && !sending}
        onSend={send}
        onWriteNow={onWriteNow}
        onStop={onStop}
        picker={allowImages ? <ImagePicker onFiles={attachments.add} /> : undefined}
      />
    </ComposerFrame>
  )
})
