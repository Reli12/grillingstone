// Template editor's save bar: discard or save as the next version.
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'

interface SaveBarProps {
  nextVersion: number
  dirty: boolean
  saving: boolean
  onDiscard: () => void
  onDelete: () => void
}

export function SaveBar({ nextVersion, dirty, saving, onDiscard, onDelete }: Readonly<SaveBarProps>) {
  return (
    <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-line bg-fog/95 py-3 backdrop-blur">
      <Button type="submit" variant="ink" disabled={!dirty || saving}>
        Save as v{nextVersion}
      </Button>
      {dirty && (
        <Button variant="quiet" onClick={onDiscard}>
          Discard changes
        </Button>
      )}
      <span className="ml-auto" />
      <Button variant="danger" onClick={onDelete}>
        <Trash2 size={14} /> Delete Template
      </Button>
    </div>
  )
}
