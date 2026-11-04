// The conversation of a Prototype Grilling Session: the same thread, question cards and Ready Check as grilling a
// Draft, and under it the message box (with Images) while the session runs, or a note once it has ended.
import { useRef } from 'react'

import { LIVE_STATUSES } from '#core/session/sessionTypes.ts'

import { useWriteNow } from '@/api/hooks/drafts/draftHooks'
import { useSayInPrototypeGrilling, useStopPrototypeGrilling } from '@/api/hooks/prototypes/prototypeGrillingHooks'
import type { PrototypeGrillingTranscript } from '@/api/prototypesApi'
import { ChatThread } from '@/components/features/chat/chatThread/chatThread'
import { Composer } from '@/components/features/chat/composer/composer'
import { shortReason } from '@/lib/prototypeLabel'

/** What the box under the thread says once the session has ended; nothing while it runs. */
function endedNote({ status, error }: Pick<PrototypeGrillingTranscript, 'status' | 'error'>) {
  switch (status) {
    case 'starting':
    case 'thinking':
    case 'waiting':
    case 'writing':
      return undefined
    case 'finished':
      return 'This session has ended. Its Prototypes are kept.'
    case 'stopped':
      return 'This session was stopped. The Prototypes written so far are kept.'
    case 'failed':
      return `This session failed: ${shortReason(error, 'prototypeGrilling')}`
    case 'interrupted':
      return 'The backend restarted while this session ran, so it was interrupted. Its Prototypes are kept.'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

/** The thread of the session, and under it the message box or the note about how it ended. */
export function GrillingSessionConversation({ session }: Readonly<{ session: PrototypeGrillingTranscript }>) {
  const composer = useRef<HTMLTextAreaElement>(null)
  const say = useSayInPrototypeGrilling(session.projectId, session.id)
  // Confirming the Ready Check is the same call as for a Grilling Session: it takes the session's id alone.
  const writeNow = useWriteNow()
  const stop = useStopPrototypeGrilling(session.projectId)
  const live = LIVE_STATUSES.includes(session.status)
  const note = endedNote(session)

  return (
    <>
      <ChatThread
        transcripts={[session]}
        liveSessionId={live ? session.id : undefined}
        onAnswer={(_sessionId, text) => say.mutate({ text, kind: 'answer' })}
        onWrite={(sessionId) => writeNow.mutate(sessionId)}
        onAddSomething={() => composer.current?.focus()}
      />
      {live ? (
        <Composer
          ref={composer}
          session={session}
          sending={say.isPending}
          onSend={(text, images, onSent) => say.mutate({ text, kind: 'message', images }, { onSuccess: onSent })}
          onWriteNow={() => writeNow.mutate(session.id)}
          onStop={() => stop.mutate(session.id)}
        />
      ) : (
        !!note && <p className="shrink-0 border-t border-line bg-sheet px-4 py-3 text-sm text-ink-soft">{note}</p>
      )}
    </>
  )
}
