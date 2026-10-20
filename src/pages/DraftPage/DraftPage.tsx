// Layout D (prototype verdict): until v1 exists the session is a full-screen chat; from v1 on the chat
// sits left and the live Draft right. "Grill this" starts a Focused Session; Proposals render inline. An ended
// session can be continued from the chat (ADR-0014).
import { useRef } from 'react'
import { useParams } from 'react-router'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ChatPane } from '@/components/features/chat/chatPane/chatPane'
import { DraftDialogs } from '@/components/features/draft/dialogs/draftDialogs/draftDialogs'
import { DraftWorkspaceLayout } from '@/components/features/draft/layout/draftWorkspaceLayout/draftWorkspaceLayout'
import { FirstSessionLayout } from '@/components/features/draft/layout/firstSessionLayout/firstSessionLayout'
import { DraftEditorContext } from '@/context/DraftEditor/DraftEditor'
import { useDraftEditorValue } from '@/hooks/draft/useDraftEditorValue'
import { useDraftMutations } from '@/hooks/draft/useDraftMutations'
import { useDraftPageData } from '@/hooks/draft/useDraftPageData'
import { useDraftPageUi } from '@/hooks/draft/useDraftPageUi'

/**
 * The newer version of the Draft's Template, when the Draft may upgrade to it: only a written Draft,
 * with no Proposal waiting and no session running.
 */
function upgradeTarget(draft: Draft, templates: Template[] | undefined, running: boolean) {
  const latest = templates?.find((template) => template.id === draft.template.id)
  const newer = latest && latest.version > draft.template.version
  if (draft.version > 0 && newer && !draft.proposal && !running) return latest
  return undefined
}

export default function DraftPage() {
  const { projectId = '', draftId = '' } = useParams()
  const composer = useRef<HTMLTextAreaElement>(null)
  const ui = useDraftPageUi()

  const { data, error, transcripts, project, templates } = useDraftPageData(projectId, draftId)
  const mutations = useDraftMutations(projectId, draftId)

  const draft = data?.draft
  const live = data?.liveSession ?? undefined
  const editor = useDraftEditorValue(draft, live, transcripts, mutations, ui.setIntent)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!draft || !transcripts || !editor) return <PageLoading />

  const chat = (
    <ChatPane
      draft={draft}
      live={live}
      transcripts={transcripts}
      mutations={mutations}
      composerRef={composer}
      continueFrom={ui.continueFrom}
      onContinueFromChange={ui.setContinueFrom}
      onShowChat={ui.showChat}
    />
  )
  const dialogs = <DraftDialogs projectId={projectId} draft={draft} mutations={mutations} ui={ui} />
  const layout = { projectId, projectName: project?.name, draft, live, ui, chat, dialogs }

  if (draft.version === 0) return <FirstSessionLayout {...layout} />
  return (
    <DraftEditorContext.Provider value={editor}>
      <DraftWorkspaceLayout
        {...layout}
        upgradeTo={upgradeTarget(draft, templates, !!live)}
        busy={editor.busy}
        onAcceptClean={() => mutations.acceptClean.mutate()}
      />
      {dialogs}
    </DraftEditorContext.Provider>
  )
}
