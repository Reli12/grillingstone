// Every dialog the Draft page can open: start a session, copy for the Tracker, References, delete.
import { useNavigate } from 'react-router'

import type { Draft } from '#core/draft/draftTypes.ts'

import { DeleteDraftDialog } from '@/components/features/draft/dialogs/deleteDraftDialog/deleteDraftDialog'
import { ReferencesDialog } from '@/components/features/draft/dialogs/referencesDialog/referencesDialog'
import { StartSessionDialog } from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import { CopyForTracker } from '@/components/features/draft/publish/copyForTracker/copyForTracker'
import type { DraftMutations } from '@/hooks/draft/useDraftMutations'
import type { DraftPageUi } from '@/hooks/draft/useDraftPageUi'
import { routesPaths } from '@/routes/routes'

interface DraftDialogsProps {
  projectId: string
  draft: Draft
  mutations: DraftMutations
  ui: DraftPageUi
}

export function DraftDialogs({ projectId, draft, mutations, ui }: Readonly<DraftDialogsProps>) {
  const navigate = useNavigate()
  const { start, remove } = mutations
  const { intent } = ui
  const startSession = (note: string, prototypeIds: string[]) => {
    if (!intent) return
    const withPrototypes = prototypeIds.length ? { prototypeIds } : {}
    const focus = intent.kind === 'focused' ? { focus: { sectionId: intent.sectionId, entryId: intent.entryId } } : {}
    const onSuccess = () => {
      ui.setIntent(null)
      ui.showChat()
    }
    start.mutate({ kind: intent.kind, ...focus, humanNote: note, ...withPrototypes }, { onSuccess })
  }
  const onDelete = () => remove.mutate(draft.id, { onSuccess: () => void navigate(routesPaths.project(projectId)) })
  return (
    <>
      <StartSessionDialog
        // A fresh dialog (and an empty note) for every new intent.
        key={intent ? JSON.stringify(intent) : 'none'}
        intent={intent}
        onClose={() => ui.setIntent(null)}
        onStart={startSession}
        pending={start.isPending}
        projectId={projectId}
      />
      <CopyForTracker
        projectId={projectId}
        draftId={draft.id}
        open={ui.copyOpen}
        onClose={() => ui.setCopyOpen(false)}
      />
      <ReferencesDialog open={ui.refsOpen} onClose={() => ui.setRefsOpen(false)} draft={draft} />
      <DeleteDraftDialog open={ui.deleteOpen} onClose={() => ui.setDeleteOpen(false)} onDelete={onDelete} />
    </>
  )
}
