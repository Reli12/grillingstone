// Backlog Copy API (ADR-0015): a Project's pasted copies of Azure DevOps work items — list, paste, re-paste, delete.
import type { BacklogCopy, PastedCopy, Repaste } from '#core/backlog/backlogCopy.ts'
import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export const backlogCopiesApi = {
  list: (projectId: string) => api.get<BacklogCopySummary[]>(endpoints.backlogCopies(projectId)),
  create: (projectId: string, pasted: PastedCopy) => api.post<BacklogCopy>(endpoints.backlogCopies(projectId), pasted),
  repaste: (projectId: string, copyId: string, repaste: Repaste) =>
    api.put<BacklogCopy>(endpoints.backlogCopy(projectId, copyId), repaste),
  delete: (projectId: string, copyId: string) => api.delete<{ ok: true }>(endpoints.backlogCopy(projectId, copyId)),
}
