// A Prototype being written: the Draft version it is built from, when it started, and Stop.
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { useStopPrototype } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { whenLabel } from '@/lib/prototypeLabel'

/** A Prototype being written: the Draft version it is built from, when it started, and Stop. */
export function RunningRow({ session }: Readonly<{ session: PrototypeSessionSummary }>) {
  const stop = useStopPrototype(session.projectId)
  return (
    <div className="flex items-center gap-3">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-claude" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Being written for Draft v{session.draftVersion}</p>
        <p className="text-[13px] text-ink-soft">Started {whenLabel(session.startedAt)}</p>
      </div>
      <Button size="sm" onClick={() => stop.mutate(session.id)} disabled={stop.isPending}>
        Stop
      </Button>
    </div>
  )
}
