// A session that failed: the short reason, a Details toggle showing Claude's last messages, Try again and Dismiss.
import { useState } from 'react'

import type { ChatMessage, PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { EndedRowActions } from '@/components/features/prototypes/endedRowActions/endedRowActions'
import { lastMessageLines, sessionDetail, shortReason } from '@/lib/prototypeLabel'

/** How many of Claude's last messages the Details show. */
const DETAIL_MESSAGES = 6

interface FailedRowProps {
  session: PrototypeSessionSummary
  messages: ChatMessage[]
  tryAgainDisabled: boolean
  onTryAgain: (session: PrototypeSessionSummary) => void
}

/** A session that failed: the short reason, Details of Claude's last messages, and Try again or Dismiss. */
export function FailedRow({ session, messages, tryAgainDisabled, onTryAgain }: Readonly<FailedRowProps>) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-redpencil">Failed</p>
          <p className="text-sm text-ink">{shortReason(session.error)}</p>
          <p className="text-[13px] text-ink-soft">{sessionDetail(session)}</p>
        </div>
        <Button size="sm" variant="quiet" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          Details
        </Button>
      </div>
      <EndedRowActions session={session} tryAgainDisabled={tryAgainDisabled} onTryAgain={onTryAgain} />
      {open && (
        <ul className="mt-2 space-y-1 rounded-md bg-fog-deep p-2 text-[13px] whitespace-pre-wrap text-ink-soft">
          {lastMessageLines(messages, DETAIL_MESSAGES).map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
