import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Settings } from '#core/contract/apiTypes.ts'

import { projectsApi } from '@/api/projectsApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const useProjects = () => useQuery({ queryKey: queryKeys.projects, queryFn: projectsApi.getProjects })
export const useProject = (projectId: string) =>
  useQuery({ queryKey: queryKeys.project(projectId), queryFn: () => projectsApi.getProject(projectId) })
export const useDrafts = (projectId: string) =>
  useQuery({ queryKey: queryKeys.drafts(projectId), queryFn: () => projectsApi.getDrafts(projectId) })
export const useGlossary = (projectId: string) =>
  useQuery({ queryKey: queryKeys.glossary(projectId), queryFn: () => projectsApi.getGlossary(projectId) })
export const useSettings = () => useQuery({ queryKey: queryKeys.settings, queryFn: projectsApi.getSettings })

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  })
}

export function useRenameProject(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => projectsApi.renameProject(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  })
}

export function useSaveGlossary(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ markdown, baseVersion }: { markdown: string; baseVersion: string }) =>
      projectsApi.saveGlossary(projectId, markdown, baseVersion),
    onSuccess: (doc) => qc.setQueryData(queryKeys.glossary(projectId), doc),
    // A stale save is refused; reload the version someone else wrote.
    onError: () => qc.invalidateQueries({ queryKey: queryKeys.glossary(projectId) }),
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: Settings) => projectsApi.saveSettings(s),
    onSuccess: (s) => qc.setQueryData(queryKeys.settings, s),
  })
}
