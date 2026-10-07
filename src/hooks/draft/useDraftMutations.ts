// Every mutation the page drives, so the parts of the page share one instance (and one pending state) each.
import {
  useAcceptAllClean,
  useContinueSession,
  useDecide,
  useDeleteDraft,
  useDraftOp,
  useSay,
  useStartSession,
  useStopSession,
  useWriteNow,
} from '@/api/hooks/drafts/draftHooks'

/** Every mutation the page drives, so the parts of the page share one instance (and one pending state) each. */
export function useDraftMutations(projectId: string, draftId: string) {
  return {
    op: useDraftOp(projectId, draftId),
    decide: useDecide(projectId, draftId),
    acceptClean: useAcceptAllClean(projectId, draftId),
    start: useStartSession(projectId, draftId),
    continueSession: useContinueSession(projectId, draftId),
    say: useSay(),
    writeNow: useWriteNow(),
    stop: useStopSession(),
    remove: useDeleteDraft(projectId),
  }
}

export type DraftMutations = ReturnType<typeof useDraftMutations>
