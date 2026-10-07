// Text on the Draft sheet that turns into an editor when clicked, and back into text when saved.
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import { useForm, type UseFormRegister } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'
import { type EditTextFormData, editTextSchema } from '@/lib/formSchemas/editTextSchema'

interface EditableTextProps {
  value: string
  /** When given, the title is edited too (Entries). */
  title?: string
  onSave: (next: { body: string; title?: string }) => void
  children: ReactNode
  className?: string
  placeholder?: string
  disabled?: boolean
}

interface ReadingViewProps {
  disabled?: boolean
  className?: string
  onStart: () => void
  children: ReactNode
}

/** The text as it reads on the sheet; a click, or Enter while focused, starts editing. */
function ReadingView({ disabled, className, onStart, children }: Readonly<ReadingViewProps>) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={onStart}
      // Only Enter on this element itself: Enter inside a link or nested control keeps its own meaning.
      onKeyDown={(event) => event.key === 'Enter' && event.target === event.currentTarget && onStart()}
      className={cn('-mx-2 rounded px-2 py-0.5', !disabled && 'cursor-text hover:bg-mark-wash/70', className)}
      title={disabled ? undefined : 'Click to edit'}
    >
      {children}
    </div>
  )
}

interface EditorViewProps {
  register: UseFormRegister<EditTextFormData>
  /** Entries edit their title too; it gets the focus first. */
  editsTitle: boolean
  placeholder?: string
  onSave: () => Promise<void>
  onCancel: () => void
}

function EditorView({ register, editsTitle, placeholder, onSave, onCancel }: Readonly<EditorViewProps>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onCancel()
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void onSave()
  }
  return (
    <div className="space-y-2 py-1" onKeyDown={onKeyDown}>
      {editsTitle && (
        <TextInput autoFocus {...register('title')} aria-label="Entry title" className="font-serif font-semibold" />
      )}
      <TextArea
        autoFocus={!editsTitle}
        minRows={3}
        {...register('body')}
        placeholder={placeholder}
        aria-label="Text"
        className="font-serif text-[15px] leading-7"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ink" onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto text-[12px] text-ink-faint">⌘↵ to save, Esc to cancel</span>
      </div>
    </div>
  )
}

type InPlaceEditOptions = Pick<EditableTextProps, 'value' | 'title' | 'disabled' | 'onSave'>

/** The edit state and form: start fills the form from the current text; save reports only real changes. */
function useInPlaceEdit({ value, title, disabled, onSave }: InPlaceEditOptions) {
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
