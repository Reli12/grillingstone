// Every session in view (all Grilling Sessions on a Draft, or one Template Session), oldest first.
// Finished sessions fold into a line and open as a read-only Transcript; the live one shows question
// cards and the Ready Check. An ended one may offer Continue (ADR-0014).
import { useState } from 'react'

import { ASSISTANT_LABELS } from '#core/session/assistantName.ts'

import { Thinking } from '@/components/atoms/thinking/thinking'
import { ThreadSession } from '@/components/features/chat/threadSession/threadSession'
import { writeTarget } from '@/constants/SessionConstants'
import { useStickToBottom } from '@/hooks/shared/useStickToBottom'
import { cn } from '@/lib/cn'
import type { AnyTranscript, ContinueOptions, Handlers } from '@/types/chat'

interface ChatThreadProps extends Handlers, ContinueOptions {
  transcripts: AnyTranscript[]
  liveSessionId?: string
  className?: string
}

export function ChatThread({ transcripts, liveSessionId, className, ...options }: Readonly<ChatThreadProps>) {
  const { canContinue, continueBlockedReason, onContinue, ...handlers } = options
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const latest = transcripts.at(-1)
  const live = transcripts.find((transcript) => transcript.id === liveSessionId)
  const messageCount = transcripts.reduce((total, transcript) => total + transcript.messages.length, 0)
  const assistantBusy = live?.status === 'thinking' || live?.status === 'starting'
  const assistant = live && ASSISTANT_LABELS[live.assistant]
  const scroller = useStickToBottom(messageCount, live?.status)

  // The latest and the live session are always open; older ones open when the human asks.
  const isExpanded = (transcript: AnyTranscript) =>
    transcript.id === latest?.id || transcript.id === liveSessionId || openIds.has(transcript.id)

  return (
    <div ref={scroller} className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      <div className="mx-auto max-w-[720px] space-y-6 px-4 py-6">
        {transcripts.map((transcript, index) => (
          <ThreadSession
            key={transcript.id}
            transcript={transcript}
            expanded={isExpanded(transcript)}
            first={index === 0}
            live={transcript.id === liveSessionId}
            onOpen={() => setOpenIds(new Set(openIds).add(transcript.id))}
            canContinue={canContinue}
            continueBlockedReason={continueBlockedReason}
            onContinue={onContinue}
            handlers={handlers}
          />
        ))}
        {assistantBusy && <Thinking className="pl-3" label={`${assistant} is thinking`} />}
        {live?.status === 'writing' && (
          <Thinking className="pl-3" label={`${assistant} is writing ${writeTarget(live.kind)}`} />
        )}
      </div>
    </div>
  )
}
