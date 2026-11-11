// The Project's Backlog Copies tab (ADR-0015): every pasted Azure DevOps work item with the Drafts referencing
// it, and paste, re-paste and delete. Pasting a work item that is already a Copy offers to re-paste it instead.
// With a Connection, a Copy can also be fetched from its link instead of pasted.
// With a Connection, a Copy can be Refreshed from its item (the same as a re-paste) or Imported as a Draft, and the
// tab says when an item changed since its Copy — it never Refreshes on its own.
import { useState } from 'react'

import { CloudDownload, ExternalLink, FilePlus2, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { parseWorkItemId, type PastedCopy } from '#core/backlog/backlogCopy.ts'
import type { BacklogCopySummary, RevisionCheck } from '#core/contract/apiTypes.ts'

import { ApiError } from '@/api/apiError'
import { useConnection, useRefreshAllCopies, useRefreshCopy, useRevisions } from '@/api/hooks/ado/adoHooks'
import {
  useBacklogCopies,
  useCreateBacklogCopy,
  useRepasteBacklogCopy,
} from '@/api/hooks/backlogCopies/backlogCopyHooks'
import { useProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { Tag } from '@/components/atoms/tag/tag'
import { EmptyState } from '@/components/composite/emptyState/emptyState'
import { DeleteCopyDialog } from '@/components/features/backlogCopies/deleteCopyDialog/deleteCopyDialog'
import { FetchCopyDialog } from '@/components/features/backlogCopies/fetchCopyDialog/fetchCopyDialog'
import { PasteCopyDialog } from '@/components/features/backlogCopies/pasteCopyDialog/pasteCopyDialog'
import { ViewCopyDialog } from '@/components/features/backlogCopies/viewCopyDialog/viewCopyDialog'
import { ImportDraftDialog } from '@/components/features/drafts/importDraftDialog/importDraftDialog'
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

type Pasting = { mode: 'new' } | { mode: 'fetch' } | { mode: 'repaste'; summary: BacklogCopySummary }

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

interface AdoRowActions {
  /** Refresh from Azure DevOps; absent without a working Connection. */
  onRefresh?: () => void
  refreshing?: boolean
  /** Import as Draft; absent without a Connection or a Backlog. */
  onImport?: () => void
  /** The item's revisions when it changed since the Copy. */
  changedSince?: RevisionCheck['changedCopies'][string]
}

function CopyRow({
  summary,
  onRepaste,
  onDelete,
  onView,
  ado,
}: Readonly<{
  summary: BacklogCopySummary
  onRepaste: () => void
  onDelete: () => void
  onView: () => void
  ado: AdoRowActions
}>) {
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
        {ado.changedSince && (
          <div className="mt-0.5 text-[12px] font-medium text-mark-ink">
            Changed in Azure DevOps since your copy (rev {ado.changedSince.from} → {ado.changedSince.to})
          </div>
        )}
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
        {ado.onRefresh && (
          <Button
            variant="quiet"
            size="sm"
            disabled={ado.refreshing}
            onClick={ado.onRefresh}
            aria-label={`Refresh #${copy.workItemId} from Azure DevOps`}
            title="Refresh from Azure DevOps"
          >
            <CloudDownload size={14} /> Refresh
          </Button>
        )}
        {ado.onImport && (
          <Button
            variant="quiet"
            size="sm"
            onClick={ado.onImport}
            aria-label={`Import #${copy.workItemId} as Draft`}
            title="Import as Draft"
          >
            <FilePlus2 size={14} />
          </Button>
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
  const [importing, setImporting] = useState<BacklogCopySummary | null>(null)
  const { data: connection } = useConnection()
  const { data: project } = useProject(projectId)
  const connected = connection?.state === 'connected'
  const { data: revisions } = useRevisions(projectId, connected)
  const refresh = useRefreshCopy(projectId)
  const refreshAll = useRefreshAllCopies(projectId)

  const refreshOne = (summary: BacklogCopySummary) =>
    refresh.mutate(summary.copy.id, {
      onSuccess: ({ changed }) =>
        toast.success(changed ? `#${summary.copy.workItemId} refreshed — its Drafts are flagged.` : 'Nothing changed.'),
      onError: (failure) => toast.error(failure.message),
    })
  const refreshEvery = () =>
    refreshAll.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`Refreshed ${result.refreshed}, ${result.changed} changed.`)
        for (const failed of result.failed) toast.error(`${failed.copyId}: ${failed.reason}`)
      },
      onError: (failure) => toast.error(failure.message),
    })
  const adoFor = (summary: BacklogCopySummary): AdoRowActions =>
    connected
      ? {
          onRefresh: () => refreshOne(summary),
          refreshing: refresh.isPending,
          ...(project?.backlog ? { onImport: () => setImporting(summary) } : {}),
          changedSince: revisions?.changedCopies[summary.copy.id],
        }
      : {}

  if (error) return <p className="text-sm text-redpencil">{error.message}</p>
  if (!summaries) return <PageLoading />

  const pasteButton = (
    <Button size="sm" variant={connected ? 'quiet' : 'outline'} onClick={() => setPasting({ mode: 'new' })}>
      <Plus size={14} /> Paste Backlog Copy
    </Button>
  )
  const addButtons = (
    <>
      {connected && (
        <Button size="sm" onClick={() => setPasting({ mode: 'fetch' })}>
          <Link2 size={14} /> Fetch from Azure DevOps
        </Button>
      )}
      {pasteButton}
    </>
  )
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-faint">
          Your local copies of Azure DevOps work items, pasted or fetched. Drafts reference them as context; when the BA
          changes an item,
          {connected
            ? 'refresh it here (or re-paste it) and every referencing Draft is flagged. Nothing is refreshed on its own.'
            : 're-paste it here and every referencing Draft is flagged. The live item is never read.'}
        </p>
        <div className="flex gap-2">
          {connected && summaries.length > 0 && (
            <Button size="sm" variant="quiet" disabled={refreshAll.isPending} onClick={refreshEvery}>
              <RefreshCw size={14} className={refreshAll.isPending ? 'animate-spin' : ''} /> Refresh all
            </Button>
          )}
          {summaries.length > 0 && addButtons}
        </div>
      </div>
      {summaries.length === 0 ? (
        <EmptyState title="No Backlog Copies yet" action={<div className="flex gap-2">{addButtons}</div>}>
          {connected ? 'Fetch or paste' : 'Paste'} the Feature you are breaking into PBIs once, then reference it from
          each of them.
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
                  ado={adoFor(summary)}
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
      {pasting?.mode === 'fetch' && (
        <FetchCopyDialog
          projectId={projectId}
          onClose={() => setPasting(null)}
          onPasteInstead={() => setPasting({ mode: 'new' })}
        />
      )}
      {pasting?.mode === 'repaste' && (
        <RepasteDialog projectId={projectId} summary={pasting.summary} onClose={() => setPasting(null)} />
      )}
      {importing && (
        <ImportDraftDialog
          key={importing.copy.id}
          projectId={projectId}
          open
          onClose={() => setImporting(null)}
          fromCopy={{ copyId: importing.copy.id, workItemId: importing.copy.workItemId }}
        />
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
