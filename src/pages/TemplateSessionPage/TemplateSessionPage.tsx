// A Template Session, full screen: the same cards as grilling a Draft. When the Template is saved the
// editor opens on it; afterwards this page is the session's read-only Transcript.
import { useRef } from 'react'
import { useParams } from 'react-router'

import { LIVE_STATUSES } from '#core/session/sessionTypes.ts'

import { useSay, useStopSession, useWriteNow } from '@/api/hooks/drafts/draftHooks'
import { useTemplateTranscript } from '@/api/hooks/templates/templateSessionHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ChatThread } from '@/components/features/chat/chatThread/chatThread'
import { Composer } from '@/components/features/chat/composer/composer'
import { SessionHeader } from '@/components/features/templates/sessionHeader/sessionHeader'
import { SessionOutcome } from '@/components/features/templates/sessionOutcome/sessionOutcome'
import { useOpenEditorOnceSaved } from '@/hooks/templates/useOpenEditorOnceSaved'

export default function TemplateSessionPage() {
  const { sessionId = '' } = useParams()
  const composer = useRef<HTMLTextAreaElement>(null)

  const { data: transcript, error } = useTemplateTranscript(sessionId)
  const say = useSay()
  const writeNow = useWriteNow()
  const stop = useStopSession()

  const live = transcript ? LIVE_STATUSES.includes(transcript.status) : false

  useOpenEditorOnceSaved(live, transcript?.status, transcript?.templateId)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!transcript) return <PageLoading />

  return (
    <div className="flex h-full flex-col">
      <SessionHeader request={transcript.request} />

      <ChatThread
        transcripts={[transcript]}
        liveSessionId={live ? transcript.id : undefined}
        onAnswer={(id, text) => say.mutate({ sessionId: id, text, kind: 'answer' })}
        onWrite={(id) => writeNow.mutate(id)}
        onAddSomething={() => composer.current?.focus()}
      />

      {live ? (
        <Composer
          ref={composer}
          session={transcript}
          allowImages={false}
          sending={say.isPending}
          onSend={(text) => say.mutate({ sessionId: transcript.id, text, kind: 'message' })}
          onWriteNow={() => writeNow.mutate(transcript.id)}
          onStop={() => stop.mutate(transcript.id)}
        />
      ) : (
        <SessionOutcome templateId={transcript.templateId} />
      )}
    </div>
  )
}
