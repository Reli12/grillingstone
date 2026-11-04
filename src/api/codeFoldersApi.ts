// Code Folder API (ADR-0016): check a folder before linking it, link, edit and unlink it, read every Code
// Folder's current branch state, and preview what a Code Folder excludes.
import type { CodeFolderCheck, CodeFolderState, ExclusionPreview } from '#core/codeFolder/codeFolderTypes.ts'
import type { Project } from '#core/contract/apiTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export interface NewCodeFolder {
  path: string
  label: string
  defaultBranch: string
  extraExclusions: string[]
}

export type CodeFolderChange = Partial<Omit<NewCodeFolder, 'path'>>

export const codeFoldersApi = {
  check: (projectId: string, path: string) => api.post<CodeFolderCheck>(endpoints.codeFolderCheck(projectId), { path }),
  add: (projectId: string, folder: NewCodeFolder) => api.post<Project>(endpoints.codeFolders(projectId), folder),
  update: (projectId: string, folderId: string, change: CodeFolderChange) =>
    api.patch<Project>(endpoints.codeFolder(projectId, folderId), change),
  remove: (projectId: string, folderId: string) => api.delete<Project>(endpoints.codeFolder(projectId, folderId)),
  state: (projectId: string) => api.get<CodeFolderState[]>(endpoints.codeFolderState(projectId)),
  exclusions: (projectId: string, folderId: string) =>
    api.get<ExclusionPreview>(endpoints.codeFolderExclusions(projectId, folderId)),
}
