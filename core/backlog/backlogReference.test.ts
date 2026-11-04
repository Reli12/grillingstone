// Tests for a Draft's Backlog References: none on older Drafts, setting them, the derived "changed" flag, and
// marking them seen once a session has received them.
import { describe, expect, it } from 'vitest'

import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import {
  backlogReferencesOf,
  changedBacklogCopies,
  markBacklogSeen,
  removeBacklogReference,
  withBacklogReferences,
} from '#core/backlog/backlogReference.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

const copy = (workItemId: number, revision: number): BacklogCopy => ({
  id: `ado-${workItemId}`,
  workItemId,
  workItemType: 'Feature',
  title: `Item ${workItemId}`,
  content: 'x',
  revision,
  pastedAt: '2026-11-04',
})
const copies = [copy(1, 3), copy(2, 1), copy(3, 5)]

const draftWith = (backlogReferences: Draft['backlogReferences']): Draft => ({ ...v1Draft(), backlogReferences })

describe('Backlog References on a Draft', () => {
  it('reads a Draft saved before Backlog References existed as having none', () => {
    const { backlogReferences: _none, ...older } = draftWith(undefined)
    expect(backlogReferencesOf(older as Draft)).toEqual([])
  })

  it('starts a newly added reference at the revision the Copy has now, and keeps what was already seen', () => {
    const draft = draftWith([{ copyId: 'ado-1', seenRevision: 2 }])
    const next = withBacklogReferences(draft, ['ado-1', 'ado-3', 'ado-ghost', 'ado-3'], copies)
    expect(next.backlogReferences).toEqual([
      { copyId: 'ado-1', seenRevision: 2 },
      { copyId: 'ado-3', seenRevision: 5 },
    ])
  })

  it('flags a Copy re-pasted since the Draft last saw it, and none that are up to date or deleted', () => {
    const draft = draftWith([
      { copyId: 'ado-1', seenRevision: 2 },
      { copyId: 'ado-2', seenRevision: 1 },
      { copyId: 'ado-gone', seenRevision: 1 },
    ])
    expect(changedBacklogCopies(draft, copies).map((changed) => changed.id)).toEqual(['ado-1'])
  })

  it('marks the delivered Copies seen at their current revision', () => {
    const draft = draftWith([
      { copyId: 'ado-1', seenRevision: 2 },
      { copyId: 'ado-2', seenRevision: 1 },
    ])
    const seen = markBacklogSeen(draft, copies)
    expect(seen.backlogReferences).toEqual([
      { copyId: 'ado-1', seenRevision: 3 },
      { copyId: 'ado-2', seenRevision: 1 },
    ])
    expect(markBacklogSeen(seen, copies)).toBe(seen)
  })

  it('removes the reference to a deleted Copy, and leaves a Draft without one as it was', () => {
    const draft = draftWith([
      { copyId: 'ado-1', seenRevision: 2 },
      { copyId: 'ado-2', seenRevision: 1 },
    ])
    expect(removeBacklogReference(draft, 'ado-1').backlogReferences).toEqual([{ copyId: 'ado-2', seenRevision: 1 }])
    expect(removeBacklogReference(draft, 'ado-9')).toBe(draft)
  })
})
