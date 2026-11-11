// The Project page's Drafts tab (ADR-0019): the filter sidebar beside the board of Lanes, or the Archived Drafts —
// or a first-Draft prompt when the Project has none.
import { useState } from 'react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { useMoveToLane, useSetArchived } from '@/api/hooks/drafts/draftHooks'
import { ArchivedDrafts } from '@/components/features/drafts/archivedDrafts/archivedDrafts'
import { DraftBoard } from '@/components/features/drafts/draftBoard/draftBoard'
import { DraftFilters, type DraftsView } from '@/components/features/drafts/draftFilters/draftFilters'
import { NoDraftsYet } from '@/components/features/drafts/noDraftsYet/noDraftsYet'
import { DRAFT_BOARD_MIN_HEIGHT } from '@/constants/DraftBoardConstants'
import { useDraftFilters } from '@/hooks/drafts/useDraftFilters'
import { cn } from '@/lib/cn'

interface ProjectDraftsProps {
  projectId: string
  drafts: DraftSummary[]
}

export function ProjectDrafts({ projectId, drafts }: Readonly<ProjectDraftsProps>) {
  const filters = useDraftFilters()
  const [view, setView] = useState<DraftsView>('board')
  const move = useMoveToLane(projectId)
  const archive = useSetArchived(projectId)

  if (!drafts.length) return <NoDraftsYet projectId={projectId} />

  const open = drafts.filter((draft) => !draft.archived)
  const archived = drafts.filter((draft) => draft.archived)
  const pool = view === 'board' ? open : archived
  const shown = pool.filter(filters.matches)
  const setArchived = (draftId: string, value: boolean) => archive.mutate({ draftId, archived: value })

  return (
    <div className={cn('grid flex-1 grid-cols-[210px_1fr] grid-rows-[minmax(0,1fr)] gap-4', DRAFT_BOARD_MIN_HEIGHT)}>
      <DraftFilters
        projectId={projectId}
        filters={filters}
        pool={pool}
        view={view}
        onView={setView}
        openCount={open.length}
        archivedCount={archived.length}
      />
      {view === 'board' ? (
        <DraftBoard
          drafts={open}
          shown={shown}
          onMove={(draftId, lane) => move.mutate({ draftId, lane })}
          onArchive={(draftId) => setArchived(draftId, true)}
        />
      ) : (
        <ArchivedDrafts drafts={shown} onRestore={(draftId) => setArchived(draftId, false)} />
      )}
    </div>
  )
}
