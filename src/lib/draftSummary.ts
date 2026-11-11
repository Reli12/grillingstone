// What a Draft in a list says about itself: whether it needs the human, what for, and how long ago it changed.
import type { DraftSummary } from '#core/contract/apiTypes.ts'
import { plural } from '#core/shared/plural.ts'

export const DAY_MS = 86_400_000

/** Something waits for the human: Changes to triage or a referenced Backlog Copy re-pasted. */
export const needsYou = (draft: DraftSummary) => draft.pendingChanges > 0 || draft.changedBacklogCopies.length > 0

/** What the human has to do, e.g. "2 changes to triage · Backlog Copy #1234 changed". */
export const needsText = (draft: DraftSummary) =>
  [
    draft.pendingChanges > 0 ? `${plural(draft.pendingChanges, 'change')} to triage` : '',
    ...draft.changedBacklogCopies.map((workItemId) => `Backlog Copy #${workItemId} changed`),
  ]
    .filter(Boolean)
    .join(' · ')

/** Today: the time. This week: "n days ago". Older: the date. */
export function updatedWhen(iso: string) {
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days < 1) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return `${plural(days, 'day')} ago`
  return date.toLocaleDateString()
}
