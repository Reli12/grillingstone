// The top of a Prototype Grilling Session's page: the way back to the Project's Prototypes, the Draft and the
// Prototype the session started from (or that there is none), Claude's step while it works, End session, and for an
// ended session Continue and (when it has no Draft) Delete session after a confirmation.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { LIVE_STATUSES } from '#core/session/sessionTypes.ts'

import { useDrafts } from '@/api/hooks/projects/projectHooks'
import {
  useContinuePrototypeGrilling,
  useDeletePrototypeGrilling,
  useEndPrototypeGrilling,
} from '@/api/hooks/prototypes/prototypeGrillingHooks'
import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import type { PrototypeGrillingTranscript } from '@/api/prototypesApi'
import { Button } from '@/components/atoms/button/button'
import { DeleteGrillingSessionDialog } from '@/components/features/prototypes/deleteGrillingSessionDialog/deleteGrillingSessionDialog'
import { startingDraftLabel, startingPrototypeLabel, stepLabel } from '@/lib/prototypeLabel'
import { finishedPrototypes } from '@/lib/prototypeRows'
import { routesPaths } from '@/routes/routes'

/** The way back, the session's starting Draft and Prototype, Claude's step, and End session. */
export function GrillingSessionHeader({ session }: Readonly<{ session: PrototypeGrillingTranscript }>) {
  const { projectId } = session
  const { data: drafts } = useDrafts(projectId)
  const { data: rows } = useProjectPrototypeRows(projectId)
  const end = useEndPrototypeGrilling(projectId)
  const resume = useContinuePrototypeGrilling(projectId)
  const remove = useDeletePrototypeGrilling(projectId)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const navigate = useNavigate()
  const live = LIVE_STATUSES.includes(session.status)
  // The new session is a page of its own: the Continuation opens there.
  const continueSession = () =>
    resume.mutate(session.id, {
      onSuccess: (next) => void navigate(routesPaths.prototypeGrillingSession(projectId, next.id)),
    })
  const { startingPrototypeId } = session.inputs
  const draftTitle = drafts?.find((draft) => draft.id === session.draft?.draftId)?.title

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-sheet px-4 py-2">
      <Link to={routesPaths.projectPrototypes(projectId)} className="text-[13px] text-ink-soft hover:text-ink">
        ← Prototypes
      </Link>
      <h1 className="text-sm font-semibold text-ink">Prototype Grilling Session</h1>
      {drafts !== undefined && (
        <span className="text-[13px] text-ink-soft">{startingDraftLabel(session.draft, draftTitle)}</span>
      )}
      {rows !== undefined && (
        <span className="text-[13px] text-ink-soft">
          {startingPrototypeLabel(startingPrototypeId, finishedPrototypes(rows))}
        </span>
      )}
      {live && session.step !== undefined && (
        <span className="text-[13px] text-claude" data-testid="prototype-step">
          {stepLabel(session.step)}
        </span>
      )}
      {live ? (
        <Button size="sm" className="ml-auto" onClick={() => end.mutate(session.id)} disabled={end.isPending}>
          End session
        </Button>
      ) : (
        <div className="ml-auto flex gap-2">
          {!session.draft && (
            <Button size="sm" variant="quiet" onClick={() => setConfirmingDelete(true)}>
              Delete session
            </Button>
          )}
          <Button size="sm" onClick={continueSession} disabled={resume.isPending}>
            Continue
          </Button>
        </div>
      )}
      <DeleteGrillingSessionDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        pending={remove.isPending}
        onDelete={() =>
          remove.mutate(session.id, { onSuccess: () => void navigate(routesPaths.projectPrototypes(projectId)) })
        }
      />
    </div>
  )
}
