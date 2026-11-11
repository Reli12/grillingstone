// The Project's Archived Drafts, off the board: each still opens, and Restore puts it back in the Lane it had.
import { Link } from 'react-router'

import { Undo2 } from 'lucide-react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { Tag } from '@/components/atoms/tag/tag'
import { updatedWhen } from '@/lib/draftSummary'
import { routesPaths } from '@/routes/routes'

interface ArchivedDraftsProps {
  /** The Archived Drafts that pass the filters. */
  drafts: DraftSummary[]
  onRestore: (draftId: string) => void
}

export function ArchivedDrafts({ drafts, onRestore }: Readonly<ArchivedDraftsProps>) {
  if (!drafts.length)
    return <p className="flex-1 py-10 text-center text-sm text-ink-faint">No Archived Drafts match the filters.</p>
  return (
    <ul className="min-w-0 flex-1 divide-y divide-line-soft self-start overflow-y-auto rounded-lg border border-line bg-sheet">
      {drafts.map((draft) => (
        <li key={draft.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <Tag className="w-16 justify-center">{draft.workItemType}</Tag>
          <Link
            to={routesPaths.draft(draft.projectId, draft.id)}
            className="min-w-0 flex-1 truncate text-ink-soft hover:text-ink hover:underline"
          >
            {draft.title || <span className="italic">{draft.requirement}</span>}
          </Link>
          <span className="text-[12px] text-ink-faint">{updatedWhen(draft.updatedAt)}</span>
          <Button variant="quiet" size="sm" onClick={() => onRestore(draft.id)}>
            <Undo2 size={13} /> Restore
          </Button>
        </li>
      ))}
    </ul>
  )
}
