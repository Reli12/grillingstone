// The gutter's mark for pending changes: red if any is a Conflict, green if all are clean.
import type { Change } from '#core/proposal/proposalTypes.ts'

/** The gutter's mark for pending changes: red if any is a Conflict, green if all are clean. */
export function pendingTone(changes: Change[]) {
  if (!changes.length) return undefined
  return changes.some((change) => change.conflict) ? 'conflict' : 'clean'
}
