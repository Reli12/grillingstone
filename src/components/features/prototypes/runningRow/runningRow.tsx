// A Prototype being written: the Draft version it is built from, when it started and how long it has run, Claude's
// latest step, and Stop.
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { useStopPrototype } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { useElapsedSince } from '@/hooks/prototypes/useElapsedSince'
import { elapsedLabel, stepLabel, whenLabel } from '@/lib/prototypeLabel'

/** A Prototype being written: the Draft version it is built from, when it started, how long, its step, and Stop. */
export function RunningRow({ session }: Readonly<{ session: PrototypeSessionSummary }>) {
  const stop = useStopPrototype(session.projectId)
  const elapsed = useElapsedSince(session.startedAt)
  return (
    <div className="flex items-center gap-3">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-claude" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Being written for Draft v{session.draftVersion}</p>
        <p className="text-[13px] text-ink-soft">{`Started ${whenLabel(session.startedAt)} · ${elapsedLabel(elapsed)}`}</p>
        {session.step !== undefined && (
          <p className="text-[13px] text-ink-soft" data-testid="prototype-step">
            {stepLabel(session.step)}
          </p>
        )}
      </div>
      <Button size="sm" onClick={() => stop.mutate(session.id)} disabled={stop.isPending}>
        Stop
      </Button>
    </div>
  )
}
