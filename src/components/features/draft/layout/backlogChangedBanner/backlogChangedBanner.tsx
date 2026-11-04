// Banner telling the human that a Backlog Copy this Draft references was re-pasted since its last session; the
// next session gets it in full with what changed, and starting it clears the flag.
import { AlertTriangle } from 'lucide-react'

import { backlogReferencesOf, changedBacklogCopies } from '#core/backlog/backlogReference.ts'
import type { Draft } from '#core/draft/draftTypes.ts'

import { useBacklogCopies } from '@/api/hooks/backlogCopies/backlogCopyHooks'

export function BacklogChangedBanner({ draft }: Readonly<{ draft: Draft }>) {
  // Only a Draft with Backlog References can be behind one; others (and Jira Projects) never ask.
  const referencing = backlogReferencesOf(draft).length > 0
  const { data: summaries } = useBacklogCopies(draft.projectId, referencing)
  const changed = summaries
    ? changedBacklogCopies(
        draft,
        summaries.map((summary) => summary.copy),
      )
    : []
  if (!changed.length) return null
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-redpencil/30 bg-redpencil-wash px-4 py-2.5 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-redpencil" />
      <div>
        {changed.map((copy) => (
          <p key={copy.id}>
            Backlog Copy #{copy.workItemId} {copy.title} changed since this Draft's last session.
          </p>
        ))}
        <p className="text-[13px] text-ink-soft">The next session gets the new text in full, with what changed.</p>
      </div>
    </div>
  )
}
