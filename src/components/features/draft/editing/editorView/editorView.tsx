// The in-place editor of an editable text: title and body fields with Save and Cancel.
import { type KeyboardEvent } from 'react'
import { type UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { type EditTextFormData } from '@/lib/formSchemas/editTextSchema'

interface EditorViewProps {
  register: UseFormRegister<EditTextFormData>
  /** Entries edit their title too; it gets the focus first. */
  editsTitle: boolean
  placeholder?: string
  onSave: () => Promise<void>
  onCancel: () => void
}

export function EditorView({ register, editsTitle, placeholder, onSave, onCancel }: Readonly<EditorViewProps>) {
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
