// A Template Session, full screen: the same cards as grilling a Draft. When the Template is saved the
// editor opens on it; afterwards this page is the session's read-only Transcript.
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { LIVE_STATUSES, type SessionStatus, type TemplateRequest } from '#core/session/sessionTypes.ts'

import { useSay, useStopSession, useWriteNow } from '@/api/hooks/drafts/draftHooks'
import { useTemplateTranscript } from '@/api/hooks/templates/templateSessionHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ChatThread } from '@/components/features/chat/chatThread/chatThread'
import { Composer } from '@/components/features/chat/composer/composer'
import { routesPaths } from '@/routes/routes'

function SessionHeader({ request }: Readonly<{ request: TemplateRequest }>) {
  return (
    <header className="shrink-0 border-b border-line bg-sheet/70 px-4 py-3 sm:px-6">
      <p className="text-[13px] text-ink-faint">
        <Link to={routesPaths.templates} className="hover:text-ink">
          Templates
        </Link>
        , new {request.workItemType} Template
        {request.baseTemplateName ? `, starting from the ${request.baseTemplateName}` : ''}
      </p>
      <p className="mt-0.5 line-clamp-2 font-serif text-[17px] text-ink">{request.purpose}</p>
    </header>
  )
}

/** Under an ended session: the Template it made, or a way to start over. */
function SessionOutcome({ templateId }: Readonly<{ templateId?: string }>) {
  return (
    <div className="shrink-0 border-t border-line bg-sheet px-4 py-4 text-center">
      {templateId ? (
        <>
          <p className="text-sm text-ink-soft">This session created a Template.</p>
          <Link to={routesPaths.template(templateId)}>
            <Button className="mt-2" variant="ink" tabIndex={-1}>
              Open the Template
            </Button>
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            The session ended without a Template. Sessions are never resumed — start a new one.
          </p>
          <Link to={routesPaths.newTemplate}>
            <Button className="mt-2" variant="claude" tabIndex={-1}>
              New Template
            </Button>
          </Link>
        </>
      )}
    </div>
  )
}

/** Seen running in this view, then saved: continue straight into the editor. */
function useOpenEditorOnceSaved(live: boolean, status?: SessionStatus, templateId?: string) {
  const navigate = useNavigate()
  const wasLive = useRef(false)
  useEffect(() => {
    if (live) wasLive.current = true
    else if (wasLive.current && status === 'finished' && templateId) void navigate(routesPaths.template(templateId))
  }, [live, status, templateId, navigate])
}

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
