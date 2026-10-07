// A Template Session, full screen: the same cards as grilling a Draft. When the Template is saved the
// editor opens on it; afterwards this page is the session's read-only Transcript.
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { LIVE_STATUSES } from '#core/session/sessionTypes.ts'

import { useSay, useStopSession, useWriteNow } from '@/api/hooks/drafts/draftHooks'
import { useTemplateTranscript } from '@/api/hooks/templates/templateSessionHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ChatThread } from '@/components/features/chat/chatThread/chatThread'
import { Composer } from '@/components/features/chat/composer/composer'
import { routesPaths } from '@/routes/routes'

export default function TemplateSessionPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const composer = useRef<HTMLTextAreaElement>(null)
  const wasLive = useRef(false)

  const { data: t, error } = useTemplateTranscript(sessionId)
  const say = useSay()
  const writeNow = useWriteNow()
  const stop = useStopSession()

  const live = t ? LIVE_STATUSES.includes(t.status) : false

  // Seen running in this view, then saved: continue straight into the editor.
  useEffect(() => {
    if (live) wasLive.current = true
    else if (wasLive.current && t?.status === 'finished' && t.templateId)
      void navigate(routesPaths.template(t.templateId))
  }, [live, t?.status, t?.templateId, navigate])

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!t) return <PageLoading />

  const { request } = t
  return (
    <div className="flex h-full flex-col">
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

      <ChatThread
        transcripts={[t]}
        liveSessionId={live ? t.id : undefined}
        onAnswer={(id, text) => say.mutate({ sessionId: id, text, kind: 'answer' })}
        onWrite={(id) => writeNow.mutate(id)}
        onAddSomething={() => composer.current?.focus()}
      />

      {live ? (
        <Composer
          ref={composer}
          session={t}
          sending={say.isPending}
          onSend={(text) => say.mutate({ sessionId: t.id, text, kind: 'message' })}
          onWriteNow={() => writeNow.mutate(t.id)}
          onStop={() => stop.mutate(t.id)}
        />
      ) : (
        <div className="shrink-0 border-t border-line bg-sheet px-4 py-4 text-center">
          {t.templateId ? (
            <>
              <p className="text-sm text-ink-soft">This session created a Template.</p>
              <Link to={routesPaths.template(t.templateId)}>
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
      )}
    </div>
  )
}
