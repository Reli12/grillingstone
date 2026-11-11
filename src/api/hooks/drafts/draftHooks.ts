// React Query hooks for a Draft: its data, Transcripts and rendered fields, every Draft mutation, where it sits on
// the Project board, and the calls that drive a Grilling Session.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { DraftLane } from '#core/draft/draftLane.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import type { SessionSummary } from '#core/session/sessionTypes.ts'

import {
  draftsApi,
  type DraftWithSession,
  type NewDraftRequest,
  type SayRequest,
  type StartSessionRequest,
} from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const useDraft = (projectId: string, draftId: string) =>
  useQuery({ queryKey: queryKeys.draft(projectId, draftId), queryFn: () => draftsApi.getDraft(projectId, draftId) })

export const useTranscripts = (projectId: string, draftId: string) =>
  useQuery({
    queryKey: queryKeys.transcripts(projectId, draftId),
    queryFn: () => draftsApi.getTranscripts(projectId, draftId),
  })

export const useCopyFields = (projectId: string, draftId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.copyFields(projectId, draftId),
    queryFn: () => draftsApi.copyFields(projectId, draftId),
    enabled,
    staleTime: 0,
  })

/** Every Draft mutation returns the saved Draft; put it straight into the cache. */
function useDraftMutation<V>(projectId: string, draftId: string, fn: (v: V) => Promise<Draft>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (draft) => {
      qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draftId), (old) => ({
        draft,
        liveSession: old?.liveSession ?? null,
      }))
      void qc.invalidateQueries({ queryKey: queryKeys.copyFields(projectId, draftId) })
    },
  })
}

export const useDraftOp = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, (op: HumanOp) => draftsApi.applyOp(projectId, draftId, op))
export const useSetReferences = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, (refs: string[]) => draftsApi.setReferences(projectId, draftId, refs))
export const useSetBacklogReferences = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, (ids: string[]) => draftsApi.setBacklogReferences(projectId, draftId, ids))
export const useDecide = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, ({ changeId, accept }: { changeId: string; accept: boolean }) =>
    draftsApi.decide(projectId, draftId, changeId, accept),
  )
export const useAcceptAllClean = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, () => draftsApi.acceptAllClean(projectId, draftId))

export function useCreateDraft(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewDraftRequest) => draftsApi.createDraft(projectId, body),
    onSuccess: ({ draft, session }) => {
      qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id), { draft, liveSession: session })
      void qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId) })
    },
  })
}

export function useDeleteDraft(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draftId: string) => draftsApi.deleteDraft(projectId, draftId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId) }),
  })
}

/** Starting or continuing a session makes it the Draft's live one. */
function useSessionLaunch<V>(projectId: string, draftId: string, fn: (v: V) => Promise<SessionSummary>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (session) => {
      qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draftId), (old) =>
        old ? { ...old, liveSession: session } : old,
      )
      void qc.invalidateQueries({ queryKey: queryKeys.transcripts(projectId, draftId) })
    },
  })
}

export const useStartSession = (projectId: string, draftId: string) =>
  useSessionLaunch(projectId, draftId, (body: StartSessionRequest) => draftsApi.startSession(projectId, draftId, body))
export const useContinueSession = (projectId: string, draftId: string) =>
  useSessionLaunch(
    projectId,
    draftId,
    ({ sessionId, humanNote, readCodeFolders }: { sessionId: string; humanNote: string; readCodeFolders?: boolean }) =>
      draftsApi.continueSession(projectId, draftId, sessionId, humanNote, readCodeFolders),
  )

export const useSay = () =>
  useMutation({
    mutationFn: ({ sessionId, ...said }: { sessionId: string } & SayRequest) => draftsApi.say(sessionId, said),
  })
export const useWriteNow = () => useMutation({ mutationFn: (sessionId: string) => draftsApi.writeNow(sessionId) })
export const useStopSession = () => useMutation({ mutationFn: (sessionId: string) => draftsApi.stop(sessionId) })

/**
 * A change to where Drafts sit on the Project board, shown in the Draft list at once and rolled back if the server
 * refuses it, so a dropped card never jumps back while the request is in flight.
 */
function useBoardMutation<V extends { draftId: string }>(
  projectId: string,
  fn: (v: V) => Promise<Draft>,
  patch: (v: V) => Partial<DraftSummary>,
) {
  const qc = useQueryClient()
  const key = queryKeys.drafts(projectId)
  return useMutation({
    mutationFn: fn,
    onMutate: async (variables: V) => {
      await qc.cancelQueries({ queryKey: key, exact: true })
      const previous = qc.getQueryData<DraftSummary[]>(key)
      qc.setQueryData<DraftSummary[]>(key, (old) =>
        old?.map((draft) => (draft.id === variables.draftId ? { ...draft, ...patch(variables) } : draft)),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => qc.setQueryData(key, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key, exact: true }),
  })
}

export const useMoveToLane = (projectId: string) =>
  useBoardMutation(
    projectId,
    ({ draftId, lane }: { draftId: string; lane: DraftLane }) => draftsApi.moveToLane(projectId, draftId, lane),
    ({ lane }) => ({ lane }),
  )

export const useSetArchived = (projectId: string) =>
  useBoardMutation(
    projectId,
    ({ draftId, archived }: { draftId: string; archived: boolean }) =>
      draftsApi.setArchived(projectId, draftId, archived),
    ({ archived }) => ({ archived }),
  )
