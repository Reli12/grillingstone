// A Draft on the Project board: type, title (a link to the Draft), version, age, its Linked Work Item, and what it
// needs from the human. Possible Drift shows as a badge and never moves the card.
import { Link } from 'react-router'

import { AlertCircle } from 'lucide-react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

import { useRevisions } from '@/api/hooks/ado/adoHooks'
import { Tag } from '@/components/atoms/tag/tag'
import { cn } from '@/lib/cn'
import { needsText, needsYou, updatedWhen } from '@/lib/draftSummary'
import { routesPaths } from '@/routes/routes'

/** Tag colour per Work Item Type; the others are ink. */
const TYPE_TONE: Partial<Record<WorkItemType, 'claude' | 'proof'>> = { PBI: 'claude', Feature: 'proof' }

interface DraftCardProps {
  draft: DraftSummary
  /** Picked up and following the pointer. */
  lifted?: boolean
}

export function DraftCard({ draft, lifted = false }: Readonly<DraftCardProps>) {
  const needs = needsYou(draft)
  // One revision check per Project, shared by every card on the board.
  const { data: revisions } = useRevisions(draft.projectId, Boolean(draft.linkedWorkItem) && !draft.archived)
  const mayHaveDrift = revisions?.mayHaveDrift.includes(draft.id) ?? false
  return (
    <div
      className={cn(
        'cursor-grab rounded-md border bg-sheet p-2.5 text-sm hover:border-ink-faint',
        needs ? 'border-redpencil/50' : 'border-line',
        lifted && 'rotate-1 cursor-grabbing shadow-xl',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Tag tone={TYPE_TONE[draft.workItemType] ?? 'ink'}>{draft.workItemType}</Tag>
        <span className="text-[11px] text-ink-faint">
          {draft.linkedWorkItem ? `#${draft.linkedWorkItem.id} · ` : ''}
          {draft.version ? `v${draft.version} · ` : ''}
          {updatedWhen(draft.updatedAt)}
        </span>
      </div>
      {/* Not natively draggable, so dragging the title moves the card instead of the link. */}
      <Link
        to={routesPaths.draft(draft.projectId, draft.id)}
        draggable={false}
        className="mt-1.5 line-clamp-2 leading-snug font-medium hover:underline"
      >
        {/* Before the first write a Draft has no title yet; show what was asked for instead. */}
        {draft.title || <span className="text-ink-soft italic">{draft.requirement}</span>}
      </Link>
      {mayHaveDrift && (
        <Tag tone="mark" className="mt-1.5" title="Changed in Azure DevOps since the last Publish; check on the Draft.">
          may have Drift
        </Tag>
      )}
      {needs && (
        <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-redpencil">
          <AlertCircle size={12} className="shrink-0" /> {needsText(draft)}
        </p>
      )}
    </div>
  )
}
