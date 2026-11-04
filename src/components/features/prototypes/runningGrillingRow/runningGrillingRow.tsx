// A Prototype Grilling Session that is live: a link to its session page, when it started and how long it has run,
// Claude's latest step, and Stop.
import { Link } from 'react-router'

import type { PrototypeGrillingSessionSummary } from '#core/session/sessionTypes.ts'

import { useStopPrototypeGrilling } from '@/api/hooks/prototypes/prototypeGrillingHooks'
import { Button } from '@/components/atoms/button/button'
import { useElapsedSince } from '@/hooks/prototypes/useElapsedSince'
import { elapsedLabel, stepLabel, whenLabel } from '@/lib/prototypeLabel'
import { routesPaths } from '@/routes/routes'

/** A live Prototype Grilling Session: a link to its page, when it started, how long, its step, and Stop. */
export function RunningGrillingRow({ session }: Readonly<{ session: PrototypeGrillingSessionSummary }>) {
  const stop = useStopPrototypeGrilling(session.projectId)
  const elapsed = useElapsedSince(session.startedAt)
  return (
    <div className="flex items-center gap-3">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-claude" aria-hidden />
      <div className="min-w-0 flex-1">
        <Link
          to={routesPaths.prototypeGrillingSession(session.projectId, session.id)}
          className="text-sm font-medium text-ink hover:text-claude hover:underline"
        >
          Prototype Grilling Session running
        </Link>
        <p className="text-[13px] text-ink-soft">{`Started ${whenLabel(session.startedAt)} · ${elapsedLabel(elapsed)}`}</p>
        {session.step !== undefined && <p className="text-[13px] text-ink-soft">{stepLabel(session.step)}</p>}
      </div>
      <Button size="sm" onClick={() => stop.mutate(session.id)} disabled={stop.isPending}>
        Stop
      </Button>
    </div>
  )
}
