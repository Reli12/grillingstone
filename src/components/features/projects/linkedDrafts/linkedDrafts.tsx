// Why a Project's Backlog is fixed: the Drafts with Linked Work Items in it, each with Unlink. Once none is left, the
// Backlog can be changed or removed again.
import { Link } from 'react-router'

import { Link2Off, Lock } from 'lucide-react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { useUnlinkWorkItem } from '@/api/hooks/ado/adoHooks'
import { Button } from '@/components/atoms/button/button'
import { routesPaths } from '@/routes/routes'

function LinkedDraftRow({ draft }: Readonly<{ draft: DraftSummary }>) {
  const unlink = useUnlinkWorkItem(draft.projectId, draft.id)
  const item = draft.linkedWorkItem!
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <Link to={routesPaths.draft(draft.projectId, draft.id)} className="min-w-0 flex-1 truncate hover:underline">
        {draft.title || draft.requirement.slice(0, 60)}
        {draft.archived && <span className="ml-1.5 text-ink-faint">(Archived)</span>}
      </Link>
      <a href={item.url} target="_blank" rel="noreferrer" className="text-[13px] text-claude hover:underline">
        #{item.id}
      </a>
      <Button
        size="sm"
        variant="quiet"
        aria-label={`Unlink #${item.id}`}
        disabled={unlink.isPending}
        onClick={() => unlink.mutate()}
      >
        <Link2Off size={14} /> Unlink
      </Button>
    </li>
  )
}

export function LinkedDrafts({ backlog, drafts }: Readonly<{ backlog: string; drafts: DraftSummary[] }>) {
  return (
    <div className="mt-3 rounded-md border border-line-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
        <Lock size={13} /> Fixed: {drafts.length === 1 ? 'this Draft has a' : 'these Drafts have'} Linked Work Item in{' '}
        {backlog}. Unlink {drafts.length === 1 ? 'it' : 'them'} to change or remove the Backlog.
      </p>
      <ul className="mt-1.5 divide-y divide-line-soft">
        {drafts.map((draft) => (
          <LinkedDraftRow key={draft.id} draft={draft} />
        ))}
      </ul>
      <p className="mt-1.5 text-[12px] text-ink-faint">
        Unlinking never touches Azure DevOps. The Draft stops tracking Drift, and its next Publish creates a new item
        unless you choose an existing one.
      </p>
    </div>
  )
}
