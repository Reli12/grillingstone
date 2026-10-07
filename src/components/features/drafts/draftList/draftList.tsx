// The Project's Drafts as a list of links: type, title, version, pending changes and last change.

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { DraftRow } from '@/components/features/drafts/draftRow/draftRow'

interface DraftListProps {
  drafts: DraftSummary[]
}

export function DraftList({ drafts }: Readonly<DraftListProps>) {
  return (
    <ul className="divide-y divide-line-soft rounded-lg border border-line bg-sheet">
      {drafts.map((draft) => (
        <li key={draft.id}>
          <DraftRow draft={draft} />
        </li>
      ))}
    </ul>
  )
}
