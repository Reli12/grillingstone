// React Query hooks for Prototypes: a Draft's and a Project's rows (kept fresh by the server events), the Images the
// start form offers, starting, stopping, deleting and dismissing, Try again's inputs, and one Prototype's record.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { prototypesApi, type StartPrototypeRequest } from '@/api/prototypesApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const usePrototypeRows = (projectId: string, draftId: string) =>
  useQuery({
    queryKey: queryKeys.draftPrototypes(projectId, draftId),
    queryFn: () => prototypesApi.getDraftRows(projectId, draftId),
  })

export const useProjectPrototypeRows = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.projectPrototypes(projectId),
    queryFn: () => prototypesApi.getProjectRows(projectId),
  })

/** The Images the start form offers for a Draft; with no Draft chosen ('') there is nothing to ask. */
export const useDraftImages = (projectId: string, draftId: string) =>
  useQuery({
    queryKey: queryKeys.draftImages(projectId, draftId),
    queryFn: () => prototypesApi.getDraftImages(projectId, draftId),
    enabled: draftId !== '',
  })

export const usePrototypeRecord = (projectId: string, prototypeId: string) =>
  useQuery({
    queryKey: queryKeys.prototype(projectId, prototypeId),
    queryFn: () => prototypesApi.getPrototype(projectId, prototypeId),
  })

/** A started or stopped session changes the rows at once; the server events then keep them current. */
function usePrototypeMutation<V, R>(projectId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.prototypes(projectId) }),
  })
}

export const useStartPrototype = (projectId: string, draftId: string) =>
  usePrototypeMutation(projectId, (body: StartPrototypeRequest) => prototypesApi.start(projectId, draftId, body))

export const useStopPrototype = (projectId: string) =>
  usePrototypeMutation(projectId, (sessionId: string) => prototypesApi.stop(projectId, sessionId))

/** Delete a finished Prototype: it leaves the Draft's list and the Project's. */
export const useDeletePrototype = (projectId: string) =>
  usePrototypeMutation(projectId, (prototypeId: string) => prototypesApi.remove(projectId, prototypeId))

/** Dismiss a Failed or Stopped session: its row leaves both lists. */
export const useDismissPrototype = (projectId: string) =>
  usePrototypeMutation(projectId, (sessionId: string) => prototypesApi.dismiss(projectId, sessionId))

/** Reads what a session was started with, once, for Try again; nothing is cached. */
export const useLoadSessionInputs = (projectId: string) =>
  useMutation({ mutationFn: (sessionId: string) => prototypesApi.getSessionInputs(projectId, sessionId) })
