import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'
import { editTextSchema, type EditTextFormData } from '@/lib/formSchemas/editTextSchema'

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

/** Click the text to edit it in place. Cmd/Ctrl+Enter saves, Escape cancels. Blank text is not saved. */
export function EditableText({ value, title, onSave, children, className, placeholder, disabled }: EditableTextProps) {
  const [editing, setEditing] = useState(false)

  const { register, handleSubmit, reset } = useForm<EditTextFormData>({ resolver: zodResolver(editTextSchema) })

  const start = () => {
    if (disabled) return
    reset({ body: value, title })
    setEditing(true)
  }
  const save = handleSubmit(
    (next) => {
      if (next.body !== value || next.title !== title) onSave(title === undefined ? { body: next.body } : { body: next.body, title: next.title })
      setEditing(false)
    },
    () => setEditing(false),
  )

  if (!editing)
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={start}
        onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && start()}
        className={cn('-mx-2 rounded px-2 py-0.5', !disabled && 'cursor-text hover:bg-mark-wash/70', className)}
        title={disabled ? undefined : 'Click to edit'}
      >
        {children}
      </div>
    )

  return (
    <div
      className="space-y-2 py-1"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false)
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
      }}
    >
      {title !== undefined && <TextInput autoFocus {...register('title')} aria-label="Entry title" className="font-serif font-semibold" />}
      <TextArea autoFocus={title === undefined} minRows={3} {...register('body')} placeholder={placeholder} aria-label="Text" className="font-serif text-[15px] leading-7" />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ink" onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <span className="ml-auto text-[12px] text-ink-faint">⌘↵ to save, Esc to cancel</span>
      </div>
    </div>
  )
}
