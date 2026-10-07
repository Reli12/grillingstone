// The inline form that adds a new Entry (title and text) to a Section.
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/atoms/button/button'
import { type EntryFormData, entrySchema } from '@/lib/formSchemas/entrySchema'

interface AddEntryFormProps {
  onSave: (title: string, body: string) => void
  onCancel: () => void
}

export function AddEntryForm({ onSave, onCancel }: Readonly<AddEntryFormProps>) {
  const { register, handleSubmit, formState } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    mode: 'onChange',
    defaultValues: { title: '', body: '' },
  })

  return (
    <form className="space-y-2" onSubmit={handleSubmit(({ title, body }) => onSave(title, body))}>
      <input
        autoFocus
        {...register('title')}
        placeholder="Title"
        aria-label="Entry title"
        className="h-9 w-full rounded-md border border-line px-3 font-serif font-semibold focus:border-claude focus:outline-none"
      />
      <textarea
        {...register('body')}
        rows={3}
        placeholder="Text"
        aria-label="Entry text"
        className="w-full rounded-md border border-line px-3 py-2 font-serif text-[15px] focus:border-claude focus:outline-none"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="ink" disabled={!formState.isValid}>
          Add
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
