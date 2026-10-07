// The message form: sends trimmed, non-blank text unless disabled, then clears the box.
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { type MessageFormData, messageSchema } from '@/lib/formSchemas/messageSchema'

interface StartFormOptions {
  disabled: boolean
  onStart: (text: string) => void
  continuingLabel?: string
}

/** The message form: sends trimmed, non-blank text unless disabled, then clears the box. */
export function useStartForm({ disabled, onStart, continuingLabel }: StartFormOptions) {
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
