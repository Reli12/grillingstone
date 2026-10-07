// The composer's buttons: Send, "Enough — write it" and Stop, enabled by the session's status.
import { Square } from 'lucide-react'

import type { SessionBase } from '#core/session/sessionTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { writeTarget } from '@/constants/SessionConstants'

interface ComposerActionsProps {
  session: SessionBase
  canSend: boolean
  onSend: () => void
  onWriteNow: () => void
  onStop: () => void
}

export function ComposerActions({ session, canSend, onSend, onWriteNow, onStop }: Readonly<ComposerActionsProps>) {
  const yourTurn = session.status === 'waiting'
  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      <Button size="sm" variant="quiet" onClick={onStop} title="Stop this session — nothing is written">
        <Square size={12} /> Stop
      </Button>
      <span className="ml-auto" />
      <Button
        size="sm"
        variant="proof"
        disabled={!yourTurn || session.status === 'writing'}
        onClick={onWriteNow}
        title={`Stop here: Claude writes ${writeTarget(session.kind)} now and decides open points with its recommended defaults`}
      >
        Enough — write it
      </Button>
      <Button size="sm" variant="ink" disabled={!canSend} onClick={onSend}>
        Send
      </Button>
    </div>
  )
}
