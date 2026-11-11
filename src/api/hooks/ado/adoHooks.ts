// React Query hooks for Azure DevOps: the Connection, a Project's Backlog and Default Tags, revision checks, Publish,
// Unlink, Drift, a Draft's Parent, Import and Refresh. Each mutation refreshes what it changed.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Project } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'

import { adoApi, type PublishChoice } from '@/api/adoApi'
import type { DraftWithSession } from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const useConnection = () => useQuery({ queryKey: queryKeys.connection, queryFn: adoApi.connection })

export function useSaveConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgUrl, token }: { orgUrl: string; token: string }) => adoApi.saveConnection(orgUrl, token),
    onSuccess: (status) => qc.setQueryData(queryKeys.connection, status),
  })
}

export function useDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adoApi.disconnect,
    onSuccess: (status) => qc.setQueryData(queryKeys.connection, status),
  })
}

/** Possible Drift and changed Backlog Copies; only Azure DevOps Projects are checked. */
export const useRevisions = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.revisions(projectId),
    queryFn: () => adoApi.revisions(projectId),
    enabled,
    staleTime: 0,
  })

function useProjectMutation<V>(projectId: string, fn: (v: V) => Promise<Project>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (project) => {
      qc.setQueryData(queryKeys.project(projectId), project)
      void qc.invalidateQueries({ queryKey: queryKeys.projects, exact: true })
    },
  })
}

export const useSetBacklog = (projectId: string) =>
  useProjectMutation(projectId, (name: string) => adoApi.setBacklog(projectId, name))
export const useClearBacklog = (projectId: string) =>
  useProjectMutation(projectId, () => adoApi.clearBacklog(projectId))
export const useSetDefaultTags = (projectId: string) =>
  useProjectMutation(projectId, (tags: string[]) => adoApi.setDefaultTags(projectId, tags))

/** Puts the saved Draft in the cache and refreshes the lists that show it. */
function useDraftSaved(projectId: string, draftId: string) {
  const qc = useQueryClient()
  return (draft: Draft) => {
    qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draftId), (old) => ({
      draft,
      liveSession: old?.liveSession ?? null,
    }))
    void qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId), exact: true })
    void qc.invalidateQueries({ queryKey: queryKeys.revisions(projectId) })
  }
}

/**
 * The plan is read only while the dialog is open, and afresh each time: Azure DevOps may have changed. `choice` is
 * what the human typed in the dialog; while the plan for a new choice loads, the previous plan stays on screen.
 */
export const usePublishPlan = (projectId: string, draftId: string, enabled: boolean, choice: PublishChoice = {}) =>
  useQuery({
    queryKey: queryKeys.publishPlan(projectId, draftId, choice.parent, choice.existing),
    queryFn: () => adoApi.publishPlan(projectId, draftId, choice),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

export function usePublish(projectId: string, draftId: string) {
  const saved = useDraftSaved(projectId, draftId)
  return useMutation({
    mutationFn: ({
      tags,
      expectedRev,
      choice,
    }: {
      tags: string[]
      expectedRev: number | null
      choice: PublishChoice
    }) => adoApi.publish(projectId, draftId, tags, expectedRev, choice),
    onSuccess: (published) => saved(published.draft),
  })
}

export function useUnlinkWorkItem(projectId: string, draftId: string) {
  const saved = useDraftSaved(projectId, draftId)
  return useMutation({ mutationFn: () => adoApi.unlink(projectId, draftId), onSuccess: saved })
}

export function useDriftCheck(projectId: string, draftId: string) {
  const saved = useDraftSaved(projectId, draftId)
  return useMutation({
    mutationFn: () => adoApi.driftCheck(projectId, draftId),
    onSuccess: (result) => saved(result.draft),
  })
}

export function useSetParent(projectId: string, draftId: string) {
  const saved = useDraftSaved(projectId, draftId)
  return useMutation({
    mutationFn: (copyId: string | null) => adoApi.setParent(projectId, draftId, copyId),
    onSuccess: saved,
  })
}

export const useLookupWorkItem = (projectId: string) =>
  useMutation({ mutationFn: (workItem: string) => adoApi.lookup(projectId, workItem) })

export function useImportDraft(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workItem, templateId }: { workItem: string; templateId: string }) =>
      adoApi.importDraft(projectId, workItem, templateId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId), exact: true }),
  })
}

export function useImportCopy(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ copyId, templateId }: { copyId: string; templateId: string }) =>
      adoApi.importCopy(projectId, copyId, templateId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId), exact: true }),
  })
}

/** A Refresh changes Copies, the Drafts' changed flags and Lanes, and what the revision check finds. */
function useRefreshMutation<V, R>(projectId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.backlogCopies(projectId) })
      void qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId), exact: true })
      void qc.invalidateQueries({ queryKey: queryKeys.revisions(projectId) })
    },
  })
}

export const useRefreshCopy = (projectId: string) =>
  useRefreshMutation(projectId, (copyId: string) => adoApi.refresh(projectId, copyId))
export const useRefreshAllCopies = (projectId: string) =>
  useRefreshMutation(projectId, () => adoApi.refreshAll(projectId))
/** Fetching a Copy creates or Refreshes one, so it changes the same lists as a Refresh. */
export const useFetchCopy = (projectId: string) =>
  useRefreshMutation(projectId, (workItem: string) => adoApi.fetchCopy(projectId, workItem))
