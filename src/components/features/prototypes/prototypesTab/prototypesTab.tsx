// The Draft side panel's Prototypes tab: 'New Prototype' with its start form, then a row for every Prototype and
// every session that is running, Failed or Stopped, newest first.
import { usePrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { PrototypeList } from '@/components/features/prototypes/prototypeList/prototypeList'
import { PrototypeStartForm } from '@/components/features/prototypes/prototypeStartForm/prototypeStartForm'
import { usePrototypeStartFlow } from '@/hooks/prototypes/usePrototypeStartFlow'
import { isWritingFor } from '@/lib/prototypeRows'

interface PrototypesTabProps {
  projectId: string
  draftId: string
}

const EMPTY_EXPLANATION =
  'A Prototype is an interactive illustration of what this Draft describes, written by Claude in one go from the Draft as it stands. Use New Prototype to have one written; you can keep grilling meanwhile.'

/** The Draft side panel's Prototypes tab. Keyed by Draft, so the start form never carries over to another Draft. */
export function PrototypesTab({ projectId, draftId }: Readonly<PrototypesTabProps>) {
  const flow = usePrototypeStartFlow(projectId)
  const { data: rows, error } = usePrototypeRows(projectId, draftId)

  if (error) return <p className="p-4 text-sm text-ink-soft">{error.message}</p>
  if (!rows) return <p className="p-4 text-sm text-ink-soft">Loading…</p>

  const writing = isWritingFor(rows, draftId)

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div>
        <Button variant="claude" disabled={writing} onClick={() => flow.openNew(draftId)}>
          New Prototype
        </Button>
        {writing && (
          <p className="mt-1.5 text-[13px] text-ink-soft">A Prototype is already being written for this Draft.</p>
        )}
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
      {rows.length > 0 && <PrototypeList rows={rows} onTryAgain={flow.tryAgain} />}
    </div>
  )
}
