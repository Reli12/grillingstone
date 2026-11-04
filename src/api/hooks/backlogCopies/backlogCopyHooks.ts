// React Query hooks for a Project's Backlog Copies. Only Azure DevOps Projects have them, so the list is fetched
// only when `enabled` says the Project is one.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { PastedCopy, Repaste } from '#core/backlog/backlogCopy.ts'

import { backlogCopiesApi } from '@/api/backlogCopiesApi'
import { queryKeys } from '@/api/reactQueryKeys'

export const useBacklogCopies = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.backlogCopies(projectId),
    queryFn: () => backlogCopiesApi.list(projectId),
    enabled,
  })

/** A change to a Copy also changes the Drafts' changed flags, so both lists refresh. */
function useBacklogMutation<V, R>(projectId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.backlogCopies(projectId) })
      void qc.invalidateQueries({ queryKey: queryKeys.drafts(projectId), exact: true })
    },
  })
}

export const useCreateBacklogCopy = (projectId: string) =>
  useBacklogMutation(projectId, (pasted: PastedCopy) => backlogCopiesApi.create(projectId, pasted))

export const useRepasteBacklogCopy = (projectId: string) =>
  useBacklogMutation(projectId, ({ copyId, repaste }: { copyId: string; repaste: Repaste }) =>
    backlogCopiesApi.repaste(projectId, copyId, repaste),
  )

export const useDeleteBacklogCopy = (projectId: string) =>
  useBacklogMutation(projectId, (copyId: string) => backlogCopiesApi.delete(projectId, copyId))
