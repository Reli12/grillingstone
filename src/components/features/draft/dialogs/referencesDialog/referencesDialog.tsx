// The References dialog: which other Drafts of the Project later sessions may read as context, and — in an Azure
// DevOps Project — which Backlog Copies the Draft derives from (ADR-0015). The two are kept apart: Draft References
// come from this tool and are always given in full, Backlog References come from Azure DevOps and are listed.
import { Link } from 'react-router'

import { backlogReferencesOf } from '#core/backlog/backlogReference.ts'
import type { Draft } from '#core/draft/draftTypes.ts'

import { useBacklogCopies } from '@/api/hooks/backlogCopies/backlogCopyHooks'
import { useSetBacklogReferences, useSetReferences } from '@/api/hooks/drafts/draftHooks'
import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { Dialog } from '@/components/composite/dialog/dialog'
import { routesPaths } from '@/routes/routes'

interface ReferencesDialogProps {
  open: boolean
  onClose: () => void
  draft: Draft
}

const rowClass =
  'flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint'

const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id])

function DraftReferences({ draft }: Readonly<{ draft: Draft }>) {
  const { data: drafts } = useDrafts(draft.projectId)
  const setReferences = useSetReferences(draft.projectId, draft.id)
  // Only Drafts with a written version have anything to read.
  const others = drafts?.filter((other) => other.id !== draft.id && other.version > 0) ?? []
  return (
    <>
      <p className="mb-3 text-sm text-ink-soft">
        Later sessions may read these Drafts as context. No hierarchy — each Draft stands on its own.
      </p>
      {others.length === 0 && <p className="text-sm text-ink-faint">No other written Drafts in this Project yet.</p>}
      <div className="space-y-1.5">
        {others.map((other) => (
          <label key={other.id} className={rowClass}>
            <input
              type="checkbox"
              className="accent-claude"
              checked={draft.references.includes(other.id)}
              onChange={() => setReferences.mutate(toggled(draft.references, other.id))}
            />
            <span className="text-ink-faint">{other.workItemType}</span>
            {other.title}
          </label>
        ))}
      </div>
    </>
  )
}

function BacklogReferences({ draft }: Readonly<{ draft: Draft }>) {
  const { data: summaries } = useBacklogCopies(draft.projectId)
  const setBacklogReferences = useSetBacklogReferences(draft.projectId, draft.id)
  const current = backlogReferencesOf(draft).map((reference) => reference.copyId)
  return (
    <section className="mt-6 border-t border-line-soft pt-4">
      <h3 className="text-sm font-semibold">Backlog References</h3>
      <p className="mb-3 text-sm text-ink-soft">
        Azure DevOps work items this Draft derives from, as you pasted them. Later sessions get them listed and read one
        when it matters. A change applies from the next session.
      </p>
      {summaries?.length === 0 && (
        <p className="text-sm text-ink-faint">
          No Backlog Copies in this Project yet —{' '}
          <Link to={routesPaths.projectBacklog(draft.projectId)} className="text-claude hover:underline">
            paste one
          </Link>
          .
        </p>
      )}
      <div className="space-y-1.5">
        {summaries?.map(({ copy }) => (
          <label key={copy.id} className={rowClass}>
            <input
              type="checkbox"
              className="accent-claude"
              checked={current.includes(copy.id)}
              onChange={() => setBacklogReferences.mutate(toggled(current, copy.id))}
            />
            <span className="text-ink-faint">{copy.workItemType}</span>#{copy.workItemId} {copy.title}
          </label>
        ))}
      </div>
    </section>
  )
}

/** Picks the other written Drafts, and the Backlog Copies, that later sessions may read as context. */
export function ReferencesDialog({ open, onClose, draft }: Readonly<ReferencesDialogProps>) {
  const { data: project } = useProject(draft.projectId)
  return (
    <Dialog open={open} onClose={onClose} title="References">
      <DraftReferences draft={draft} />
      {project?.tracker === 'azure-devops' && <BacklogReferences draft={draft} />}
    </Dialog>
  )
}
