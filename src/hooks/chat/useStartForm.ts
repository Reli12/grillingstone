// The start form: sends trimmed text and the pending Images unless disabled, then clears the box.
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import type { ImageUpload } from '#core/session/images.ts'

import { useImageAttachments } from '@/hooks/chat/useImageAttachments'
import { imageMessageSchema, type MessageFormData } from '@/lib/formSchemas/messageSchema'

/** Called once the start has worked, with the id of the session it started (if it started one). */
export type OnStarted = (startedSessionId?: string) => void

interface StartFormOptions {
  disabled: boolean
  onStart: (text: string, images: ImageUpload[], onStarted: OnStarted) => void
  continuingLabel?: string
  /** A Continuation's first message takes no Images (the larger request limit applies to saying and starting only). */
  allowImages: boolean
  /** Where this box keeps its Images' size and hint until a session exists; one per Draft. */
  sessionKey: string
}

/** The start form: sends trimmed text and the pending Images unless disabled, then clears the box. */
export function useStartForm({ disabled, onStart, continuingLabel, allowImages, sessionKey }: StartFormOptions) {
  const { register, handleSubmit, reset, setFocus, control } = useForm<MessageFormData>({
    resolver: zodResolver(imageMessageSchema),
    mode: 'onChange',
    defaultValues: { text: '' },
  })
  const attachments = useImageAttachments(sessionKey)

  // Choosing to continue a session moves the cursor into the box, ready for the first words.
  useEffect(() => {
    if (continuingLabel) setFocus('text')
  }, [continuingLabel, setFocus])

  const hasWords = useWatch({ control, name: 'text' }).trim().length > 0
  const hasSomething = hasWords || (allowImages && attachments.pending.length > 0)

  const send = handleSubmit(({ text }) => {
    if (disabled || !hasSomething) return
    const batch = allowImages ? attachments.batch() : { uploads: [], ids: [], bytes: 0 }
    // The Images leave the box only once the session has started; their size and hint move to that session.
    onStart(text, batch.uploads, (startedSessionId) => attachments.markSent(batch, startedSessionId))
    reset()
  })
  return { register, send, canSend: !disabled && hasSomething, attachments }
}
