// A Draft's Lane on the Project board (ADR-0019): set by the human, except that new work for the human moves the
// Draft to "Needs you". A Draft saved before Lanes existed gets one from what it holds.
import type { Draft } from '#core/draft/draftTypes.ts'

export const DRAFT_LANES = ['grilling', 'needs', 'review', 'ready'] as const
export type DraftLane = (typeof DRAFT_LANES)[number]

export const isDraftLane = (value: unknown): value is DraftLane => DRAFT_LANES.includes(value as DraftLane)

const pendingChanges = (draft: Draft) =>
  draft.proposal?.changes.filter((change) => change.status === 'pending').length ?? 0

/** The Lane a Draft has, or would start in: Needs you with something to triage, Grilling before v1, else In review. */
export function laneOf(draft: Draft, hasChangedBacklogCopy = false): DraftLane {
  if (draft.lane) return draft.lane
  if (pendingChanges(draft) > 0 || hasChangedBacklogCopy) return 'needs'
  return draft.version === 0 ? 'grilling' : 'review'
}

/**
 * `next` moved to Needs you when it brings a new Proposal with something to triage. Only new work moves a Draft —
 * a Draft the human moved away from Needs you stays where they put it until more work arrives. Archived Drafts
 * never move.
 */
export function withNewWorkLane(previous: Draft, next: Draft): Draft {
  if (next.archived || next.lane === 'needs') return next
  const newProposal = next.proposal !== null && next.proposal.id !== previous.proposal?.id
  return newProposal && pendingChanges(next) > 0 ? { ...next, lane: 'needs' } : next
}

/** The Draft in `lane`; the same Draft when it is already there. */
export const moveToLane = (draft: Draft, lane: DraftLane): Draft => (draft.lane === lane ? draft : { ...draft, lane })

/** The Draft Archived or restored; the same Draft when nothing changes. */
export const setArchived = (draft: Draft, archived: boolean): Draft =>
  Boolean(draft.archived) === archived ? draft : { ...draft, archived }
