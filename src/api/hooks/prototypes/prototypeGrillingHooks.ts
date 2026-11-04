// React Query hooks for Prototype Grilling Sessions: one session with its conversation (kept fresh by the server
// events), starting one, saying something in it, stopping it and ending it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { SayRequest } from '@/api/draftsApi'
import { prototypesApi, type StartPrototypeGrillingRequest } from '@/api/prototypesApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const usePrototypeGrillingSession = (projectId: string, sessionId: string) =>
  useQuery({
    queryKey: queryKeys.prototypeGrillingSession(projectId, sessionId),
    queryFn: () => prototypesApi.getGrilling(projectId, sessionId),
  })

/** A started, stopped or ended session changes the rows at once; the server events then keep them current. */
function useGrillingMutation<V, R>(projectId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.prototypes(projectId) }),
  })
}

export const useStartPrototypeGrilling = (projectId: string) =>
  useGrillingMutation(projectId, (body: StartPrototypeGrillingRequest) => prototypesApi.startGrilling(projectId, body))

export const useStopPrototypeGrilling = (projectId: string) =>
  useGrillingMutation(projectId, (sessionId: string) => prototypesApi.stopGrilling(projectId, sessionId))

export const useContinuePrototypeGrilling = (projectId: string) =>
  useGrillingMutation(projectId, (sessionId: string) => prototypesApi.continueGrilling(projectId, sessionId))

export const useEndPrototypeGrilling = (projectId: string) =>
  useGrillingMutation(projectId, (sessionId: string) => prototypesApi.endGrilling(projectId, sessionId))

/** Deletes an ended Draft-less session with its Prototypes and Transcript. */
export const useDeletePrototypeGrilling = (projectId: string) =>
  useGrillingMutation(projectId, (sessionId: string) => prototypesApi.removeGrilling(projectId, sessionId))

/** A message of the human: its words and Images reach the conversation through the server events. */
export const useSayInPrototypeGrilling = (projectId: string, sessionId: string) =>
  useMutation({ mutationFn: (said: SayRequest) => prototypesApi.sayInGrilling(projectId, sessionId, said) })
