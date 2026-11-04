// The Project's Backlog Copies tab (ADR-0015): every pasted Azure DevOps work item with the Drafts referencing
// it, and paste, re-paste and delete. Pasting a work item that is already a Copy offers to re-paste it instead.
import { useState } from 'react'

import { ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react'

import { parseWorkItemId, type PastedCopy } from '#core/backlog/backlogCopy.ts'
import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'

import { ApiError } from '@/api/apiError'
import {
  useBacklogCopies,
  useCreateBacklogCopy,
  useRepasteBacklogCopy,
} from '@/api/hooks/backlogCopies/backlogCopyHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { Tag } from '@/components/atoms/tag/tag'
import { EmptyState } from '@/components/composite/emptyState/emptyState'
import { DeleteCopyDialog } from '@/components/features/backlogCopies/deleteCopyDialog/deleteCopyDialog'
import { PasteCopyDialog } from '@/components/features/backlogCopies/pasteCopyDialog/pasteCopyDialog'
import { ViewCopyDialog } from '@/components/features/backlogCopies/viewCopyDialog/viewCopyDialog'
import { cn } from '@/lib/cn'

const DAY_MS = 86_400_000

/** Today / n days ago / the date, like the Draft list. */
const pastedWhen = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
  if (days < 1) return 'today'
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

const toRepaste = ({ workItemType, title, content, acceptanceCriteria = '' }: PastedCopy) => ({
  workItemType,
  title,
  content,
  acceptanceCriteria,
})

type Pasting = { mode: 'new' } | { mode: 'repaste'; summary: BacklogCopySummary }

/** Pasting a new Copy; a 409 for a work item already copied turns into an offer to re-paste that Copy. */
function NewCopyDialog({
  projectId,
  summaries,
  onClose,
}: Readonly<{ projectId: string; summaries: BacklogCopySummary[]; onClose: () => void }>) {
  const create = useCreateBacklogCopy(projectId)
  const repaste = useRepasteBacklogCopy(projectId)
  const [last, setLast] = useState<PastedCopy | null>(null)
  const parsed = last ? parseWorkItemId(last.workItem) : null
  const conflict = create.error instanceof ApiError && create.error.status === 409
  const existing =
    conflict && parsed?.ok ? summaries.find((summary) => summary.copy.workItemId === parsed.workItemId) : undefined
  const offer = existing && last && (
    <Button
      variant="claude"
      size="sm"
      disabled={repaste.isPending}
      onClick={() => repaste.mutate({ copyId: existing.copy.id, repaste: toRepaste(last) }, { onSuccess: onClose })}
    >
      Re-paste #{existing.copy.workItemId} instead
    </Button>
  )
  return (
    <PasteCopyDialog
      onClose={onClose}
      pending={create.isPending}
      error={create.error?.message ?? repaste.error?.message}
      notice={offer}
      onSubmit={(values) => {
        setLast(values)
        create.mutate(values, { onSuccess: onClose })
      }}
    />
  )
}

function RepasteDialog({
  projectId,
  summary,
  onClose,
}: Readonly<{ projectId: string; summary: BacklogCopySummary; onClose: () => void }>) {
  const repaste = useRepasteBacklogCopy(projectId)
  return (
    <PasteCopyDialog
      copy={summary.copy}
      referencingCount={summary.drafts.length}
      onClose={onClose}
      pending={repaste.isPending}
      error={repaste.error?.message}
      onSubmit={(values) =>
        repaste.mutate({ copyId: summary.copy.id, repaste: toRepaste(values) }, { onSuccess: onClose })
      }
    />
  )
}

function CopyRow({
  summary,
  onRepaste,
  onDelete,
  onView,
}: Readonly<{ summary: BacklogCopySummary; onRepaste: () => void; onDelete: () => void; onView: () => void }>) {
  const { copy, drafts } = summary
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <span className="font-mono text-ink-faint">#{copy.workItemId}</span>{' '}
        <button
          type="button"
          onClick={onView}
          className="cursor-pointer text-left font-medium underline-offset-2 hover:text-claude hover:underline"
        >
          {copy.title}
        </button>
        <div className="text-[12px] text-ink-faint">
          Revision {copy.revision}
          {copy.acceptanceCriteria ? ' · with Acceptance Criteria' : ''}
        </div>
      </td>
      <td className="px-2 py-3">
        <Tag>{copy.workItemType}</Tag>
      </td>
      <td className="px-2 py-3 whitespace-nowrap text-ink-soft">{pastedWhen(copy.pastedAt)}</td>
      <td className="px-2 py-3">
        {drafts.length === 0 && <span className="text-ink-faint">—</span>}
        {drafts.map((draft) => (
          <div key={draft.id} className={cn('text-[13px]', draft.changed ? 'text-redpencil' : 'text-ink-soft')}>
            {draft.title || <span className="italic">{draft.requirement || 'Not written yet'}</span>}
            {draft.changed && <span className="ml-1.5 font-medium">· changed</span>}
          </div>
        ))}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {copy.url && (
          <a
            href={copy.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open #${copy.workItemId} in Azure DevOps`}
            title="Open in Azure DevOps"
            className="mr-1 inline-flex h-7 items-center rounded-md px-2 align-middle text-ink-soft hover:bg-fog-deep hover:text-ink"
          >
            <ExternalLink size={14} />
          </a>
        )}
        <Button variant="quiet" size="sm" onClick={onRepaste} aria-label={`Re-paste #${copy.workItemId}`}>
          <RefreshCw size={14} /> Re-paste
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete} aria-label={`Delete #${copy.workItemId}`} title="Delete">
          <Trash2 size={14} />
        </Button>
      </td>
    </tr>
  )
}

export function BacklogCopiesPanel({ projectId }: Readonly<{ projectId: string }>) {
  const { data: summaries, error } = useBacklogCopies(projectId)
  const [pasting, setPasting] = useState<Pasting | null>(null)
  const [deleting, setDeleting] = useState<BacklogCopySummary | null>(null)
  const [viewing, setViewing] = useState<BacklogCopySummary | null>(null)

  if (error) return <p className="text-sm text-redpencil">{error.message}</p>
  if (!summaries) return <PageLoading />

  const pasteButton = (
    <Button size="sm" onClick={() => setPasting({ mode: 'new' })}>
      <Plus size={14} /> Paste Backlog Copy
    </Button>
  )
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-faint">
          Your pasted copies of Azure DevOps work items. Drafts reference them as context; when the BA changes an item,
          re-paste it here and every referencing Draft is flagged. The live item is never read.
        </p>
        {summaries.length > 0 && pasteButton}
      </div>
      {summaries.length === 0 ? (
        <EmptyState title="No Backlog Copies yet" action={pasteButton}>
          Paste the Feature you are breaking into PBIs once, then reference it from each of them.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-sheet">
          <table className="w-full text-sm">
            <thead className="bg-fog/60 text-left text-[12px] text-ink-faint">
              <tr>
                <th className="px-4 py-2 font-medium">Work item</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Last pasted</th>
                <th className="px-2 py-2 font-medium">Referenced by</th>
                <th className="px-4 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {summaries.map((summary) => (
                <CopyRow
                  key={summary.copy.id}
                  summary={summary}
                  onRepaste={() => setPasting({ mode: 'repaste', summary })}
                  onDelete={() => setDeleting(summary)}
                  onView={() => setViewing(summary)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewing && (
        <ViewCopyDialog
          summary={viewing}
          onClose={() => setViewing(null)}
          onRepaste={() => {
            setViewing(null)
            setPasting({ mode: 'repaste', summary: viewing })
          }}
        />
      )}
      {pasting?.mode === 'new' && (
        <NewCopyDialog projectId={projectId} summaries={summaries} onClose={() => setPasting(null)} />
      )}
      {pasting?.mode === 'repaste' && (
        <RepasteDialog projectId={projectId} summary={pasting.summary} onClose={() => setPasting(null)} />
      )}
      {deleting && (
        <DeleteCopyDialog
          key={deleting.copy.id}
          projectId={projectId}
          summary={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
