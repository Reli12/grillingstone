// A Draft's Backlog References: which Backlog Copies it derives from and the revision of each its last session
// received. Whether a Copy "changed since this Draft's last session" is derived from that, never stored.
import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import type { BacklogReference, Draft } from '#core/draft/draftTypes.ts'

/** A Draft saved before Backlog References existed has none. */
export const backlogReferencesOf = (draft: Draft): BacklogReference[] => draft.backlogReferences ?? []

/**
 * The Draft referencing exactly these Copies, in this order. A Copy it already referenced keeps the revision its
 * last session saw; a new one starts at the Copy's current revision, since nothing changed since it was added.
 * Unknown Copy ids and repeats are dropped.
 */
export function withBacklogReferences(draft: Draft, copyIds: string[], copies: BacklogCopy[]): Draft {
  const current = new Map(backlogReferencesOf(draft).map((reference) => [reference.copyId, reference]))
  const byId = new Map(copies.map((copy) => [copy.id, copy]))
  const references: BacklogReference[] = []
  for (const copyId of new Set(copyIds)) {
    const copy = byId.get(copyId)
    const kept = current.get(copyId)
    // A Copy it keeps referencing stays its Parent; removing the Parent's Copy leaves the Draft without one.
    if (copy)
      references.push({
        copyId,
        seenRevision: kept?.seenRevision ?? copy.revision,
        ...(kept?.parent ? { parent: true } : {}),
      })
  }
  return { ...draft, backlogReferences: references }
}

/** The referenced Copies re-pasted since the Draft's last session; a deleted Copy is never "changed". */
export function changedBacklogCopies(draft: Draft, copies: BacklogCopy[]): BacklogCopy[] {
  const byId = new Map(copies.map((copy) => [copy.id, copy]))
  return backlogReferencesOf(draft).flatMap((reference) => {
    const copy = byId.get(reference.copyId)
    return copy && copy.revision > reference.seenRevision ? [copy] : []
  })
}

/** Every delivered Copy as seen at its current revision; the same Draft when nothing moves. */
export function markBacklogSeen(draft: Draft, delivered: BacklogCopy[]): Draft {
  const revisionOf = new Map(delivered.map((copy) => [copy.id, copy.revision]))
  let moved = false
  const references = backlogReferencesOf(draft).map((reference) => {
    const revision = revisionOf.get(reference.copyId)
    if (revision === undefined || revision === reference.seenRevision) return reference
    moved = true
    return { ...reference, seenRevision: revision }
  })
  return moved ? { ...draft, backlogReferences: references } : draft
}

/** The Draft without its reference to a deleted Copy; the same Draft when it had none. */
export function removeBacklogReference(draft: Draft, copyId: string): Draft {
  const references = backlogReferencesOf(draft)
  if (!references.some((reference) => reference.copyId === copyId)) return draft
  return { ...draft, backlogReferences: references.filter((reference) => reference.copyId !== copyId) }
}

/** The Backlog Reference the human marked as the Draft's Parent, if any. */
export const parentReference = (draft: Draft): BacklogReference | undefined =>
  backlogReferencesOf(draft).find((reference) => reference.parent)

/** The work item ID of the Draft's Parent, from its Backlog Copy; null without a Parent (or a deleted Copy). */
export function parentWorkItemId(draft: Draft, copies: BacklogCopy[]): number | null {
  const reference = parentReference(draft)
  return copies.find((copy) => copy.id === reference?.copyId)?.workItemId ?? null
}

/**
 * The Draft with `copyId` as its Parent, or with no Parent for null. Only a Copy the Draft already references can
 * be its Parent; the same Draft when nothing changes.
 */
export function withParent(draft: Draft, copyId: string | null): Draft {
  const references = backlogReferencesOf(draft)
  if (copyId !== null && !references.some((reference) => reference.copyId === copyId)) return draft
  if ((parentReference(draft)?.copyId ?? null) === copyId) return draft
  return {
    ...draft,
    backlogReferences: references.map(({ parent: _was, ...reference }) =>
      reference.copyId === copyId ? { ...reference, parent: true } : reference,
    ),
  }
}
