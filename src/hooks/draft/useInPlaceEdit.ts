// The edit state and form: start fills the form from the current text; save reports only real changes.
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import type { EditableTextProps } from '@/components/features/draft/editing/editableText/editableText'
import { type EditTextFormData, editTextSchema } from '@/lib/formSchemas/editTextSchema'

type InPlaceEditOptions = Pick<EditableTextProps, 'value' | 'title' | 'disabled' | 'onSave'>

/** The edit state and form: start fills the form from the current text; save reports only real changes. */
export function useInPlaceEdit({ value, title, disabled, onSave }: InPlaceEditOptions) {
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset } = useForm<EditTextFormData>({ resolver: zodResolver(editTextSchema) })

  const start = () => {
    if (disabled) return
    reset({ body: value, title })
    setEditing(true)
  }
  const cancel = () => setEditing(false)
  // An invalid (blank) edit closes the editor without saving.
  const save = handleSubmit((next) => {
    const changed = next.body !== value || next.title !== title
    if (changed) onSave(title === undefined ? { body: next.body } : { body: next.body, title: next.title })
    setEditing(false)
  }, cancel)
  return { editing, start, save, cancel, register }
}
