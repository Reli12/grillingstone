// The Project page's Prototypes tab: every Prototype and every running, Failed or Stopped session of every Draft in
// the Project, newest first. '+ New Prototype' asks which Draft, then opens the same start form as the Draft's own tab.
import { useState } from 'react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { DraftChooser } from '@/components/features/prototypes/draftChooser/draftChooser'
import { PrototypeList } from '@/components/features/prototypes/prototypeList/prototypeList'
import { PrototypeStartForm } from '@/components/features/prototypes/prototypeStartForm/prototypeStartForm'
import { usePrototypeStartFlow } from '@/hooks/prototypes/usePrototypeStartFlow'
import { writingDraftIds } from '@/lib/prototypeRows'

interface ProjectPrototypesTabProps {
  projectId: string
  drafts: DraftSummary[]
}

const EMPTY_EXPLANATION =
  'A Prototype is an interactive illustration of what a Draft describes, written by Claude in one go from the Draft as it stands. Use + New Prototype to choose a Draft at v1 or later and have one written; you can keep grilling meanwhile.'

/** The Project page's Prototypes tab: every Prototype of every Draft, and '+ New Prototype' with a Draft chooser. */
export function ProjectPrototypesTab({ projectId, drafts }: Readonly<ProjectPrototypesTabProps>) {
  const [choosing, setChoosing] = useState(false)
  const flow = usePrototypeStartFlow(projectId)
  const { data: rows, error } = useProjectPrototypeRows(projectId)

  if (error) return <p className="py-4 text-sm text-ink-soft">{error.message}</p>
  if (!rows) return <p className="py-4 text-sm text-ink-soft">Loading…</p>

  const draftTitles = new Map(drafts.map((draft) => [draft.id, draft.title]))
  const writing = writingDraftIds(rows)
  const chosen = flow.open ? draftTitles.get(flow.open.draftId) : undefined

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Button
          variant="claude"
          onClick={() => {
            flow.close()
            setChoosing(true)
          }}
        >
          + New Prototype
        </Button>
      </div>
      {choosing && (
        <DraftChooser
          drafts={drafts}
          writing={writing}
          onChoose={(draftId) => {
            setChoosing(false)
            flow.openNew(draftId)
          }}
          onCancel={() => setChoosing(false)}
        />
      )}
      {flow.open !== null && (
        <div className="space-y-2">
          {chosen !== undefined && <p className="text-sm text-ink-soft">For the Draft “{chosen}”</p>}
          <PrototypeStartForm
            key={flow.open.key}
            projectId={projectId}
            draftId={flow.open.draftId}
            initial={flow.open.initial}
            onCancel={flow.close}
            onStarted={flow.close}
          />
        </div>
      )}
      {rows.length === 0 && !choosing && !flow.open && (
        <div className="rounded-lg border border-dashed border-line p-4">
          <p className="text-sm font-medium text-ink">No Prototypes yet</p>
          <p className="mt-1 text-sm text-ink-soft">{EMPTY_EXPLANATION}</p>
        </div>
      )}
      {rows.length > 0 && <PrototypeList rows={rows} draftTitles={draftTitles} onTryAgain={flow.tryAgain} />}
    </div>
  )
}
