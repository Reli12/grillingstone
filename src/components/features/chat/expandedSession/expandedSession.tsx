// One session of the chat thread shown in full: heading, where it started from, and its messages.
import { type ReactNode } from 'react'

import { Messages } from '@/components/features/chat/messages/messages'
import { SessionHeading } from '@/components/features/chat/sessionHeading/sessionHeading'
import { SessionOrigin } from '@/components/features/chat/sessionOrigin/sessionOrigin'
import { SESSION_TITLES } from '@/constants/SessionConstants'
import type { AnyTranscript, Handlers } from '@/types/chat'

interface ExpandedSessionProps {
  transcript: AnyTranscript
  first: boolean
  live: boolean
  continueButton: ReactNode
  handlers: Handlers
}

export function ExpandedSession({ transcript, first, live, continueButton, handlers }: Readonly<ExpandedSessionProps>) {
  return (
    <section aria-label={`${SESSION_TITLES[transcript.kind]} transcript`}>
      <h3 className="mb-4 flex items-center gap-3 text-[13px]">
        <span className="h-px flex-1 bg-line" />
        <span>
          <SessionHeading transcript={transcript} />
        </span>
        {continueButton}
        <span className="h-px flex-1 bg-line" />
      </h3>
      <SessionOrigin transcript={transcript} first={first} />
      <Messages transcript={transcript} live={live} {...handlers} />
    </section>
  )
}
