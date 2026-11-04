// React Query hooks for a Project's Code Folders. Their branch state changes outside the tool (the human switches
// branch in their editor), so it is never cached as fresh: every place that shows it reads it again.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Project } from '#core/contract/apiTypes.ts'

import { type CodeFolderChange, codeFoldersApi, type NewCodeFolder } from '@/api/codeFoldersApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const useCodeFolderState = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.codeFolderState(projectId),
    queryFn: () => codeFoldersApi.state(projectId),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

export const useCodeFolderExclusions = (projectId: string, folderId: string) =>
  useQuery({
    queryKey: queryKeys.codeFolderExclusions(projectId, folderId),
    queryFn: () => codeFoldersApi.exclusions(projectId, folderId),
    staleTime: 0,
  })

export const useCheckCodeFolder = (projectId: string) =>
  useMutation({ mutationFn: (path: string) => codeFoldersApi.check(projectId, path) })

/** Every change returns the Project; it replaces the cached one, and the state and previews are read again. */
function useCodeFolderMutation<V>(projectId: string, fn: (v: V) => Promise<Project>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (project) => {
      qc.setQueryData(queryKeys.project(projectId), project)
      void qc.invalidateQueries({ queryKey: queryKeys.codeFolderState(projectId) })
      void qc.invalidateQueries({ queryKey: ['projects', projectId, 'codeFolderExclusions'] })
    },
  })
}

export const useAddCodeFolder = (projectId: string) =>
  useCodeFolderMutation(projectId, (folder: NewCodeFolder) => codeFoldersApi.add(projectId, folder))

export const useUpdateCodeFolder = (projectId: string) =>
  useCodeFolderMutation(projectId, ({ folderId, change }: { folderId: string; change: CodeFolderChange }) =>
    codeFoldersApi.update(projectId, folderId, change),
  )

export const useRemoveCodeFolder = (projectId: string) =>
  useCodeFolderMutation(projectId, (folderId: string) => codeFoldersApi.remove(projectId, folderId))
