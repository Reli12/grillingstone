// The References dialog: which other Drafts of the Project later sessions may read as context, and — in an Azure
// DevOps Project — which Backlog Copies the Draft derives from (ADR-0015), one of them its Parent. Tabs per kind, a
// filterable table, and staged changes: ticking only marks a row; Save writes them all, Discard drops them.
import { useState } from 'react'
import { Link } from 'react-router'

import type { Draft } from '#core/draft/draftTypes.ts'

import { useProject } from '@/api/hooks/projects/projectHooks'
import { Dialog } from '@/components/composite/dialog/dialog'
import { ReferencesNav } from '@/components/features/draft/references/referencesNav/referencesNav'
import { ReferencesSaveBar } from '@/components/features/draft/references/referencesSaveBar/referencesSaveBar'
import { ReferencesTable } from '@/components/features/draft/references/referencesTable/referencesTable'
import { ReferencesToolbar } from '@/components/features/draft/references/referencesToolbar/referencesToolbar'
import { type ReferenceFilters, type ReferenceTab, useReferenceFilters } from '@/hooks/draft/useReferenceFilters'
import { type ReferenceSelection, useReferenceSelection } from '@/hooks/draft/useReferenceSelection'
import { routesPaths } from '@/routes/routes'

interface ReferencesDialogProps {
  open: boolean
  onClose: () => void
  draft: Draft
}

/** What the table says when it has no rows: nothing of that kind yet, or nothing matching the filters. */
function emptyText(selection: ReferenceSelection, tab: ReferenceTab, filters: ReferenceFilters): string {
  const { total, hiddenArchived } = filters
  if (hiddenArchived)
    return `No Active Drafts match. ${hiddenArchived} Archived ${hiddenArchived === 1 ? 'one is' : 'ones are'} hidden — choose Archived or All to see ${hiddenArchived === 1 ? 'it' : 'them'}.`
  if (total > 0) return 'Nothing matches the filters.'
  if (tab === 'draft') return 'No other written Drafts in this Project yet.'
  if (tab === 'backlog') return 'No Backlog Copies in this Project yet.'
  return selection.items.length ? 'Nothing in use yet. Tick rows in the other tabs.' : 'Nothing to reference yet.'
}

/** Mounted only while the dialog is open, so it starts from the Draft as saved each time. */
function ReferencesBody({ draft, withBacklog }: Readonly<{ draft: Draft; withBacklog: boolean }>) {
  const selection = useReferenceSelection(draft, withBacklog)
  const [tab, setTab] = useState<ReferenceTab>('draft')
  const filters = useReferenceFilters(selection, tab)
  return (
    <div className="flex h-[min(64vh,640px)] flex-col gap-4 md:flex-row">
      <ReferencesNav selection={selection} tab={tab} onTab={setTab} withBacklog={withBacklog} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <ReferencesToolbar filters={filters} tab={tab} />
        <ReferencesTable
          selection={selection}
          rows={filters.rows}
          tab={tab}
          withBacklog={withBacklog}
          empty={emptyText(selection, tab, filters)}
        />
        {tab === 'backlog' && filters.total === 0 && (
          <p className="text-[13px] text-ink-faint">
            <Link to={routesPaths.projectBacklog(draft.projectId)} className="text-claude hover:underline">
              Paste or fetch one
            </Link>{' '}
            in the Project’s Backlog tab.
          </p>
        )}
        <ReferencesSaveBar selection={selection} />
      </div>
    </div>
  )
}

/** Picks the other written Drafts, and the Backlog Copies, that later sessions may read as context. */
export function ReferencesDialog({ open, onClose, draft }: Readonly<ReferencesDialogProps>) {
  const { data: project } = useProject(draft.projectId)
  return (
    <Dialog open={open} onClose={onClose} title="References" className="w-[min(1100px,calc(100vw-32px))]">
      {project && <ReferencesBody draft={draft} withBacklog={project.tracker === 'azure-devops'} />}
    </Dialog>
  )
}
