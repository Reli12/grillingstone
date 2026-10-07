import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'

import type { GlossaryTerm } from '#core/glossary/glossary.ts'

import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { type GlossaryTermFormData, glossaryTermSchema } from '@/lib/formSchemas/glossaryTermSchema'

interface TermEditorProps {
  initial: GlossaryTerm
  onSave: (t: GlossaryTerm) => void
  onCancel: () => void
  /** Offered only for an existing term. */
  onRemove?: () => void
}

export function TermEditor({ initial, onSave, onCancel, onRemove }: TermEditorProps) {
  const { register, handleSubmit, formState } = useForm<GlossaryTermFormData>({
    resolver: zodResolver(glossaryTermSchema),
    mode: 'onChange',
    defaultValues: initial,
  })

  return (
    <form className="space-y-2 rounded-md border border-claude/40 bg-sheet p-3" onSubmit={handleSubmit(onSave)}>
      <TextInput autoFocus {...register('term')} placeholder="Term" aria-label="Term" className="font-semibold" />
      <TextArea
        minRows={2}
        {...register('definition')}
        placeholder="What it is, in one or two sentences"
        aria-label="Definition"
      />
      <TextInput {...register('avoid')} placeholder="Words to avoid, comma separated" aria-label="Avoid" />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="ink" disabled={!formState.isValid}>
          Save term
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        {onRemove && (
          <Button size="sm" variant="danger" className="ml-auto" onClick={onRemove}>
            <Trash2 size={14} /> Remove
          </Button>
        )}
      </div>
    </form>
  )
}
