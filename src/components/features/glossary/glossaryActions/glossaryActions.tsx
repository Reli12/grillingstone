// The Glossary panel's actions: add a term, or edit the raw Markdown.
import { Plus } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'

interface GlossaryActionsProps {
  /** Adding waits until no term is open in an editor. */
  canAdd: boolean
  onAdd: () => void
  onEditRaw: () => void
}

export function GlossaryActions({ canAdd, onAdd, onEditRaw }: Readonly<GlossaryActionsProps>) {
  return (
    <div className="mt-3 flex items-center gap-1">
      <Button size="sm" variant="quiet" onClick={onAdd} disabled={!canAdd}>
        <Plus size={14} /> Add term
      </Button>
      <Button size="sm" variant="quiet" onClick={onEditRaw} className="ml-auto">
        Edit as markdown
      </Button>
    </div>
  )
}
