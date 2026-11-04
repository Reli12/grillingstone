// Backlog Reference delivery: how a Grilling Session receives each Backlog Copy the Draft references. The first
// session reads every one in full; later ones only get a listing, unless the human asks for them in full or the
// Copy was re-pasted since the Draft's last session — then it comes in full, with what changed.
import { type BacklogCopy, backlogCopyChanges } from '#core/backlog/backlogCopy.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'

export type DeliveryMode = 'full' | 'full-with-changes' | 'listed'

export interface DeliveryInput {
  kind: SessionKind
  /** "Include Backlog References in full", chosen when starting the session. */
  includeInFull: boolean
  /** Each reference with the Copy as it is now and the revision the Draft's last session saw. */
  references: { copy: BacklogCopy; seenRevision: number }[]
}

export interface DeliveredReference {
  copy: BacklogCopy
  mode: DeliveryMode
  /** For full-with-changes: how many re-pastes happened since the Draft's last session. */
  missedRepastes?: number
  /** What the last re-paste changed; only when exactly that one re-paste was missed. */
  changes?: string
}

function deliver(kind: SessionKind, includeInFull: boolean, copy: BacklogCopy, seenRevision: number) {
  if (kind === 'first') return { copy, mode: 'full' as const }
  const missedRepastes = copy.revision - seenRevision
  if (missedRepastes > 0) {
    // Only the content the last re-paste replaced is kept, so a diff exists only for exactly one missed re-paste.
    const changes = missedRepastes === 1 ? backlogCopyChanges(copy) : ''
    return { copy, mode: 'full-with-changes' as const, missedRepastes, ...(changes ? { changes } : {}) }
  }
  return { copy, mode: includeInFull ? ('full' as const) : ('listed' as const) }
}

export function deliverBacklogReferences({ kind, includeInFull, references }: DeliveryInput): DeliveredReference[] {
  return references.map(({ copy, seenRevision }) => deliver(kind, includeInFull, copy, seenRevision))
}
