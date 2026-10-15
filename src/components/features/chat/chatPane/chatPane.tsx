// The session thread, and under it the live session's Composer or the idle message box.
import { type RefObject } from 'react'

import { heldByOtherAssistant } from '#core/session/continuation.ts'
import { LIVE_STATUSES, type SessionSummary, type Transcript } from '#core/session/sessionTypes.ts'

import { useSettings } from '@/api/hooks/projects/projectHooks'
import { ChatThread } from '@/components/features/chat/chatThread/chatThread'
import { Composer } from '@/components/features/chat/composer/composer'
import type { IdleComposerProps } from '@/components/features/chat/idleComposer/idleComposer'
import { IdleComposer } from '@/components/features/chat/idleComposer/idleComposer'
import type { Continuable } from '@/types/draftPage'

interface ChatPaneProps extends Omit<IdleComposerProps, 'latest' | 'canContinue'> {
  live?: SessionSummary
  transcripts: Transcript[]
  composerRef: RefObject<HTMLTextAreaElement | null>
}

/** The session thread, and under it the live session's Composer or the idle message box. */
export function ChatPane({ live, transcripts, composerRef, ...idleProps }: Readonly<ChatPaneProps>) {
  const { draft, mutations, onContinueFromChange } = idleProps
  const { say, writeNow, stop } = mutations
  const { data: settings } = useSettings()
  // An ended session can be continued if its Assistant kept the conversation and nothing else is open.
  const continuable = (transcript: Continuable) =>
    !live && !draft.proposal && !!transcript.conversationId && !LIVE_STATUSES.includes(transcript.status)
  // The conversation belongs to the Assistant that held it: Continue waits for Settings, and while they name the
  // other Assistant it stays visible but disabled, saying why.
  const heldHere = (transcript: Continuable) => transcript.assistant === settings?.assistant
  const canContinue = (transcript: Continuable) => continuable(transcript) && heldHere(transcript)
  const continueBlockedReason = (transcript: Continuable) =>
    settings && continuable(transcript) && !heldHere(transcript)
      ? heldByOtherAssistant(transcript.assistant)
      : undefined
  return (
    <>
      <ChatThread
        transcripts={transcripts}
        liveSessionId={live?.id}
        canContinue={canContinue}
        continueBlockedReason={continueBlockedReason}
        onContinue={(id) => onContinueFromChange(transcripts.find((transcript) => transcript.id === id) ?? null)}
        onAnswer={(sessionId, text) => say.mutate({ sessionId, text, kind: 'answer' })}
        onWrite={(sessionId) => writeNow.mutate(sessionId)}
        onAddSomething={() => composerRef.current?.focus()}
      />
      {live ? (
        <Composer
          ref={composerRef}
          session={live}
          sending={say.isPending}
          onSend={(text) => say.mutate({ sessionId: live.id, text, kind: 'message' })}
          onWriteNow={() => writeNow.mutate(live.id)}
          onStop={() => stop.mutate(live.id)}
        />
      ) : (
        <IdleComposer {...idleProps} latest={transcripts.at(-1)} canContinue={canContinue} />
      )}
    </>
  )
}
