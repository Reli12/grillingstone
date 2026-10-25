// One row of a Prototypes list, whichever kind it is: being written, Failed, Stopped or a finished Prototype.
import type { Prototype, PrototypeRow as Row } from '#core/prototype/prototypeRecords.ts'
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { FailedRow } from '@/components/features/prototypes/failedRow/failedRow'
import { FinishedRow } from '@/components/features/prototypes/finishedRow/finishedRow'
import { RunningRow } from '@/components/features/prototypes/runningRow/runningRow'
import { StoppedRow } from '@/components/features/prototypes/stoppedRow/stoppedRow'
import { startedFromLabel } from '@/lib/prototypeLabel'

interface PrototypeRowProps {
  row: Row
  /** The finished Prototypes of the list, to name the one a Prototype started from. */
  prototypes: Prototype[]
  /** A Prototype is being written for this row's Draft, so Try again waits. */
  writing: boolean
  onTryAgain: (session: PrototypeSessionSummary) => void
}

/** One row of a Prototypes list, whichever kind it is. */
export function PrototypeRow({ row, prototypes, writing, onTryAgain }: Readonly<PrototypeRowProps>) {
  switch (row.kind) {
    case 'running':
      return <RunningRow session={row.session} />
    case 'failed':
      return (
        <FailedRow session={row.session} messages={row.messages} tryAgainDisabled={writing} onTryAgain={onTryAgain} />
      )
    case 'stopped':
      return <StoppedRow session={row.session} tryAgainDisabled={writing} onTryAgain={onTryAgain} />
    case 'finished':
      return <FinishedRow prototype={row.prototype} startedFrom={startedFromLabel(row.prototype, prototypes)} />
    default: {
      const _exhaustive: never = row
      return _exhaustive
    }
  }
}
