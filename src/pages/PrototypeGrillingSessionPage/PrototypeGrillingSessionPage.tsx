// A Prototype Grilling Session, full screen: the conversation on the left, and on the right the session's newest
// Prototype in the sandboxed frame with a strip to flip between the rounds. The header names where it started from.
import { useParams } from 'react-router'

import { usePrototypeGrillingSession } from '@/api/hooks/prototypes/prototypeGrillingHooks'
import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { GrillingSessionConversation } from '@/components/features/prototypes/grillingSessionConversation/grillingSessionConversation'
import { GrillingSessionHeader } from '@/components/features/prototypes/grillingSessionHeader/grillingSessionHeader'
import { GrillingSessionViewer } from '@/components/features/prototypes/grillingSessionViewer/grillingSessionViewer'
import { sessionPrototypes } from '@/lib/prototypeRows'

export default function PrototypeGrillingSessionPage() {
  const { projectId = '', sessionId = '' } = useParams()
  const { data: session, error } = usePrototypeGrillingSession(projectId, sessionId)
  const { data: rows } = useProjectPrototypeRows(projectId)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!session) return <PageLoading />

  const written = sessionPrototypes(rows ?? [], session.prototypeIds)
  const [first, ...others] = written

  return (
    <div className="flex h-full flex-col">
      <GrillingSessionHeader session={session} />
      <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-1">
        <section
          aria-label="Conversation"
          className="flex min-h-0 flex-col border-b border-line lg:border-r lg:border-b-0"
        >
          <GrillingSessionConversation session={session} />
        </section>
        <section aria-label="Prototype" className="flex min-h-0 flex-col">
          {written.length > 0 ? (
            // A new `key` for each round, so the strip is back on the newest Prototype when one is written.
            <GrillingSessionViewer key={session.prototypeIds.length} prototypes={[first, ...others]} />
          ) : (
            <p className="p-6 text-sm text-ink-soft">
              No Prototype yet. Claude writes the first one once you confirm it is ready to write.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
