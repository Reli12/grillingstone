// How many Backlog References a Draft has and how many of their Copies changed since its last session.
import { backlogReferencesOf, changedBacklogCopies } from '#core/backlog/backlogReference.ts'
import type { Draft } from '#core/draft/draftTypes.ts'

import { useBacklogCopies } from '@/api/hooks/backlogCopies/backlogCopyHooks'

export function useBacklogStatus(draft: Draft) {
  const count = backlogReferencesOf(draft).length
  // Only a Draft with Backlog References asks; a Jira Project's Drafts never have any.
  const { data: summaries } = useBacklogCopies(draft.projectId, count > 0)
  const changed = summaries
    ? changedBacklogCopies(
        draft,
        summaries.map((summary) => summary.copy),
      ).length
    : 0
  return { count, changed }
}
