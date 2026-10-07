import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import type { SessionSummary } from '#core/session/sessionTypes.ts'

import { draftsApi, type DraftWithSession, type NewDraftRequest, type StartSessionRequest } from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const useDraft = (projectId: string, draftId: string) =>
  useQuery({ queryKey: queryKeys.draft(projectId, draftId), queryFn: () => draftsApi.getDraft(projectId, draftId) })

export const useTranscripts = (projectId: string, draftId: string) =>
  useQuery({
    queryKey: queryKeys.transcripts(projectId, draftId),
    queryFn: () => draftsApi.getTranscripts(projectId, draftId),
  })

export const useRendered = (projectId: string, draftId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.render(projectId, draftId),
    queryFn: () => draftsApi.render(projectId, draftId),
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
      void qc.invalidateQueries({ queryKey: queryKeys.render(projectId, draftId) })
    },
  })
}

export const useDraftOp = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, (op: HumanOp) => draftsApi.applyOp(projectId, draftId, op))
export const useSetReferences = (projectId: string, draftId: string) =>
  useDraftMutation(projectId, draftId, (refs: string[]) => draftsApi.setReferences(projectId, draftId, refs))
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
  useSessionLaunch(projectId, draftId, ({ sessionId, humanNote }: { sessionId: string; humanNote: string }) =>
    draftsApi.continueSession(projectId, draftId, sessionId, humanNote),
  )

export const useSay = () =>
  useMutation({
    mutationFn: ({ sessionId, text, kind }: { sessionId: string; text: string; kind: 'answer' | 'message' }) =>
      draftsApi.say(sessionId, text, kind),
  })
export const useWriteNow = () => useMutation({ mutationFn: (sessionId: string) => draftsApi.writeNow(sessionId) })
export const useStopSession = () => useMutation({ mutationFn: (sessionId: string) => draftsApi.stop(sessionId) })
