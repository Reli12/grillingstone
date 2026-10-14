// The Glossary's actions: add a term, or edit the raw Markdown.
import { Plus } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'

interface GlossaryActionsProps {
  /** Both wait while a term or the whole markdown is open, so neither edit is thrown away. */
  disabled: boolean
  onAdd: () => void
  onEditRaw: () => void
}

export function GlossaryActions({ disabled, onAdd, onEditRaw }: Readonly<GlossaryActionsProps>) {
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="quiet" onClick={onAdd} disabled={disabled}>
        <Plus size={14} /> Add term
      </Button>
      <Button size="sm" variant="quiet" onClick={onEditRaw} disabled={disabled}>
        Edit as markdown
      </Button>
    </div>
  )
}
