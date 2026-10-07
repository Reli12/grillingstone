// Text on the Draft sheet that turns into an editor when clicked, and back into text when saved.
import { type ReactNode } from 'react'

import { EditorView } from '@/components/features/draft/editing/editorView/editorView'
import { ReadingView } from '@/components/features/draft/editing/readingView/readingView'
import { useInPlaceEdit } from '@/hooks/draft/useInPlaceEdit'

export interface EditableTextProps {
  value: string
  /** When given, the title is edited too (Entries). */
  title?: string
  onSave: (next: { body: string; title?: string }) => void
  children: ReactNode
  className?: string
  placeholder?: string
  disabled?: boolean
}

/** Click the text to edit it in place. Cmd/Ctrl+Enter saves, Escape cancels. Blank text is not saved. */
export function EditableText({
  value,
  title,
  onSave,
  children,
  className,
  placeholder,
  disabled,
}: Readonly<EditableTextProps>) {
  const { editing, start, save, cancel, register } = useInPlaceEdit({ value, title, disabled, onSave })

  if (!editing)
    return (
      <ReadingView disabled={disabled} className={className} onStart={start}>
        {children}
      </ReadingView>
    )

  return (
    <EditorView
      register={register}
      editsTitle={title !== undefined}
      placeholder={placeholder}
      onSave={save}
      onCancel={cancel}
    />
  )
}
