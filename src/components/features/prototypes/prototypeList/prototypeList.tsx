// The list of Prototype rows, newest first as the backend sends them. On the Project's tab each row also says which
// Draft it belongs to.
import type { PrototypeRow as Row } from '#core/prototype/prototypeRecords.ts'
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { PrototypeRow } from '@/components/features/prototypes/prototypeRow/prototypeRow'
import { finishedPrototypes, rowDraftId, rowId, writingDraftIds } from '@/lib/prototypeRows'

interface PrototypeListProps {
  rows: Row[]
  /** Draft id → title; given, each row names its Draft. */
  draftTitles?: ReadonlyMap<string, string>
  onTryAgain: (session: PrototypeSessionSummary) => void
}

/** The list of Prototype rows, newest first as the backend sends them. */
export function PrototypeList({ rows, draftTitles, onTryAgain }: Readonly<PrototypeListProps>) {
  const prototypes = finishedPrototypes(rows)
  const writing = writingDraftIds(rows)
  return (
    <ul aria-label="Prototypes" className="space-y-2">
      {rows.map((row) => {
        const draftId = rowDraftId(row)
        const title = draftTitles?.get(draftId)
        return (
          <li key={rowId(row)} className="rounded-lg border border-line bg-sheet p-3">
            {draftTitles !== undefined && (
              <p className="mb-1 truncate text-[13px] font-medium text-ink">{title ?? 'A deleted Draft'}</p>
            )}
            <PrototypeRow row={row} prototypes={prototypes} writing={writing.has(draftId)} onTryAgain={onTryAgain} />
          </li>
        )
      })}
    </ul>
  )
}
