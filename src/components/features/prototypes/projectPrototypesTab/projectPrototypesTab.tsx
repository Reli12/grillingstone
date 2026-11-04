// The Project page's Prototypes tab: every Prototype and every running, Failed or Stopped session in the Project,
// with or without a Draft, newest first. '+ New Prototype' opens the New Prototype form, the same as the Draft's tab.
import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { PrototypeList } from '@/components/features/prototypes/prototypeList/prototypeList'
import { PrototypeStartForm } from '@/components/features/prototypes/prototypeStartForm/prototypeStartForm'
import { usePrototypeStartFlow } from '@/hooks/prototypes/usePrototypeStartFlow'

interface ProjectPrototypesTabProps {
  projectId: string
  drafts: DraftSummary[]
}

const EMPTY_EXPLANATION =
  'A Prototype is an interactive illustration of what a Draft describes, written by Claude. Use + New Prototype to talk through a screen with Claude, from Images, an earlier Prototype or a Draft, or to have one written in one go from a Draft at v1 or later; you can keep grilling the Draft meanwhile.'

/** The Project page's Prototypes tab: every Prototype of the Project, and '+ New Prototype'. */
export function ProjectPrototypesTab({ projectId, drafts }: Readonly<ProjectPrototypesTabProps>) {
  const flow = usePrototypeStartFlow(projectId)
  const { data: rows, error } = useProjectPrototypeRows(projectId)

  if (error) return <p className="py-4 text-sm text-ink-soft">{error.message}</p>
  if (!rows) return <p className="py-4 text-sm text-ink-soft">Loading…</p>

  const draftTitles = new Map(drafts.map((draft) => [draft.id, draft.title]))

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Button variant="claude" onClick={() => flow.openNew()}>
          + New Prototype
        </Button>
      </div>
      {flow.open !== null && (
        <PrototypeStartForm
          key={flow.open.key}
          projectId={projectId}
          draftId={flow.open.draftId}
          initial={flow.open.initial}
          onCancel={flow.close}
          onStarted={flow.close}
        />
      )}
      {rows.length === 0 && !flow.open && (
        <div className="rounded-lg border border-dashed border-line p-4">
          <p className="text-sm font-medium text-ink">No Prototypes yet</p>
          <p className="mt-1 text-sm text-ink-soft">{EMPTY_EXPLANATION}</p>
        </div>
      )}
      {rows.length > 0 && <PrototypeList rows={rows} draftTitles={draftTitles} onTryAgain={flow.tryAgain} />}
    </div>
  )
}
