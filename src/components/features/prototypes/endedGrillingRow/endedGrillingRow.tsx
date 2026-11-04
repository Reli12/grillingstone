// A Prototype Grilling Session that ended without writing a Prototype: a link to its page, where Continue (and, with
// no Draft, Delete) are, how it ended and when it started.
import { Link } from 'react-router'

import type { PrototypeGrillingSessionSummary, SessionStatus } from '#core/session/sessionTypes.ts'

import { shortReason, whenLabel } from '@/lib/prototypeLabel'
import { routesPaths } from '@/routes/routes'

/** How an ended session ended, in words; a Failed one gives its reason. */
function endingOf({ status, error }: Pick<PrototypeGrillingSessionSummary, 'status' | 'error'>) {
  const ended: SessionStatus = status
  switch (ended) {
    case 'stopped':
      return 'Stopped. No Prototype was written.'
    case 'failed':
      return `Failed: ${shortReason(error, 'prototypeGrilling')}`
    case 'interrupted':
      return 'Interrupted by a backend restart. No Prototype was written.'
    case 'starting':
    case 'thinking':
    case 'waiting':
    case 'writing':
    case 'finished':
      return 'Ended. No Prototype was written.'
    default: {
      const _exhaustive: never = ended
      return _exhaustive
    }
  }
}

/** An ended Prototype Grilling Session that wrote no Prototype. */
export function EndedGrillingRow({ session }: Readonly<{ session: PrototypeGrillingSessionSummary }>) {
  return (
    <div>
      <Link
        to={routesPaths.prototypeGrillingSession(session.projectId, session.id)}
        className="text-sm font-medium text-ink hover:text-claude hover:underline"
      >
        Prototype Grilling Session
      </Link>
      <p className="text-sm text-ink-soft">{endingOf(session)}</p>
      <p className="text-[13px] text-ink-soft">{`Started ${whenLabel(session.startedAt)}`}</p>
    </div>
  )
}
