// A Discarded Section or Entry, collapsed to one line with Restore, plus any changes proposed for it.
import { Undo2 } from 'lucide-react'

import type { Change } from '#core/proposal/proposalTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { Changes } from '@/components/features/draft/proposal/changes/changes'

interface DiscardedLineProps {
  label: string
  onRestore: () => void
  changes: Change[]
}

export function DiscardedLine({ label, onRestore, changes }: Readonly<DiscardedLineProps>) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded border border-dashed border-line px-2.5 py-1.5 text-[13px] text-ink-faint">
        <span className="min-w-0 flex-1 truncate line-through">{label}</span>
        <span className="shrink-0">Discarded</span>
        <Button size="sm" variant="quiet" onClick={onRestore}>
          <Undo2 size={13} /> Restore
        </Button>
      </div>
      <Changes changes={changes} />
    </div>
  )
}
