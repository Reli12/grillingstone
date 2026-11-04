// What can be done with a Failed or Stopped row: Try again with the same inputs, or Dismiss it.
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { useDismissPrototype } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'

interface EndedRowActionsProps {
  session: PrototypeSessionSummary
  /** A Prototype is being written for the Draft, so another can't be started yet. */
  tryAgainDisabled: boolean
  onTryAgain: (session: PrototypeSessionSummary) => void
}

/** What can be done with a Failed or Stopped row: Try again with the same inputs, or Dismiss it. */
export function EndedRowActions({ session, tryAgainDisabled, onTryAgain }: Readonly<EndedRowActionsProps>) {
  const dismiss = useDismissPrototype(session.projectId)
  return (
    <div className="mt-2 flex gap-2">
      <Button size="sm" disabled={tryAgainDisabled} onClick={() => onTryAgain(session)}>
        Try again
      </Button>
      <Button size="sm" variant="quiet" disabled={dismiss.isPending} onClick={() => dismiss.mutate(session.id)}>
        Dismiss
      </Button>
    </div>
  )
}
