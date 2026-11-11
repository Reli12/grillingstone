// Under the References table: nothing is saved until Save. With unsaved changes it sums them up and offers Discard
// (asking first) and Save; after a save it says the changes apply from the next session.
import { useState } from 'react'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { referenceName, type ReferenceSelection } from '@/hooks/draft/useReferenceSelection'

function summary(selection: ReferenceSelection): string {
  const parent = selection.items.find((item) => item.id === selection.parent)
  return [
    selection.added.length && `${selection.added.length} added`,
    selection.removed.length && `${selection.removed.length} removed`,
    selection.parentChanged && (parent ? `Parent → ${referenceName(parent)}` : 'Parent removed'),
  ]
    .filter(Boolean)
    .join(' · ')
}

export function ReferencesSaveBar({ selection }: Readonly<{ selection: ReferenceSelection }>) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saved, setSaved] = useState(false)
  const { changeCount } = selection
  if (!changeCount)
    return (
      <p role="status" className="text-[13px] text-ink-faint">
        {saved
          ? 'Saved. The changes apply from the next session.'
          : 'Tick rows to add or remove. Nothing is saved until you press Save.'}
      </p>
    )
  const save = () =>
    selection.save().then(
      () => setSaved(true),
      () => undefined,
    )
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-claude/40 bg-claude-wash px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm">
          <strong>
            {changeCount} unsaved change{changeCount === 1 ? '' : 's'}
          </strong>{' '}
          <span className="text-ink-soft">· {summary(selection)}</span>
        </p>
        {confirmDiscard ? (
          <>
            <span className="text-[13px] text-redpencil">Discard them?</span>
            <Button size="sm" variant="quiet" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                selection.discard()
                setConfirmDiscard(false)
                setSaved(false)
              }}
            >
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="quiet" disabled={selection.saving} onClick={() => setConfirmDiscard(true)}>
              Discard
            </Button>
            <Button size="sm" variant="ink" disabled={selection.saving} onClick={() => void save()}>
              {selection.saving && <Loader2 size={13} className="animate-spin" />}
              Save changes
            </Button>
          </>
        )}
      </div>
      {selection.error && (
        <p role="alert" className="mt-1.5 text-[13px] text-redpencil">
          {selection.error.message}
        </p>
      )}
    </div>
  )
}
