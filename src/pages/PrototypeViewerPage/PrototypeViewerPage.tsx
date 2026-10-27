// A Prototype in its own browser tab: a thin bar over a full-height frame that loads the view route. The frame is
// sandboxed (scripts, forms and dialogs only), so the page inside is an opaque origin that can't reach this app.
import { useParams } from 'react-router'

import { usePrototypeRecord } from '@/api/hooks/prototypes/prototypeHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { PrototypeFrame } from '@/components/features/prototypes/prototypeFrame/prototypeFrame'
import { PrototypeViewerBar } from '@/components/features/prototypes/prototypeViewerBar/prototypeViewerBar'

export default function PrototypeViewerPage() {
  const { projectId = '', prototypeId = '' } = useParams()
  const { data, error } = usePrototypeRecord(projectId, prototypeId)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!data) return <PageLoading />

  return (
    <div className="flex h-full flex-col">
      <PrototypeViewerBar prototype={data.prototype} draftTitle={data.draftTitle} />
      <PrototypeFrame projectId={projectId} prototypeId={prototypeId} />
    </div>
  )
}
