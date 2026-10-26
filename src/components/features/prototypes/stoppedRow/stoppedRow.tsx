// A session the human stopped: it kept no Prototype. Try again or Dismiss.
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { EndedRowActions } from '@/components/features/prototypes/endedRowActions/endedRowActions'
import { sessionDetail } from '@/lib/prototypeLabel'

interface StoppedRowProps {
  session: PrototypeSessionSummary
  tryAgainDisabled: boolean
  onTryAgain: (session: PrototypeSessionSummary) => void
}

/** A session the human stopped: it kept no Prototype. */
export function StoppedRow({ session, tryAgainDisabled, onTryAgain }: Readonly<StoppedRowProps>) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-soft">Stopped</p>
      <p className="text-sm text-ink">Nothing was kept.</p>
      <p className="text-[13px] text-ink-soft">{sessionDetail(session)}</p>
      <EndedRowActions session={session} tryAgainDisabled={tryAgainDisabled} onTryAgain={onTryAgain} />
    </div>
  )
}
