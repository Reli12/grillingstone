// Tests for Draft Lanes: the Lane a Draft starts in, the move to Needs you on new work only, and Archiving.
import { describe, expect, it } from 'vitest'

import { laneOf, moveToLane, setArchived, withNewWorkLane } from '#core/draft/draftLane.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { Change, Proposal } from '#core/proposal/proposalTypes.ts'
import { rewriteAc02, v1Draft } from '#core/testing/fixtures.ts'

const proposal = (draft: Draft, id: string, status: Change['status'] = 'pending'): Proposal => ({
  id,
  sessionId: 's1',
  kind: 'iteration',
  createdAt: '2026-09-22',
  changes: [{ ...rewriteAc02(draft), id: 'c1', label: 'AC02', after: 'x', conflict: false, status }],
})

describe('laneOf', () => {
  it('keeps the Lane the human set', () => {
    const draft = { ...v1Draft(), lane: 'ready' as const }
    expect(laneOf({ ...draft, proposal: proposal(draft, 'p1') })).toBe('ready')
  })

  it('derives a Lane for a Draft saved before Lanes existed', () => {
    const draft = v1Draft()
    expect(laneOf({ ...draft, version: 0 })).toBe('grilling')
    expect(laneOf(draft)).toBe('review')
    expect(laneOf({ ...draft, proposal: proposal(draft, 'p1') })).toBe('needs')
    expect(laneOf(draft, true)).toBe('needs')
  })
})

describe('withNewWorkLane', () => {
  const draft = { ...v1Draft(), lane: 'review' as const }

  it('moves a Draft to Needs you when a new Proposal brings something to triage', () => {
    expect(withNewWorkLane(draft, { ...draft, proposal: proposal(draft, 'p1') }).lane).toBe('needs')
  })

  it('leaves a Draft the human moved away while the same Proposal is still pending', () => {
    const before = { ...draft, proposal: proposal(draft, 'p1') }
    const after = { ...before, requirement: 'edited' }
    expect(withNewWorkLane(before, after)).toBe(after)
  })

  it('leaves a Proposal with nothing pending, and Archived Drafts, where they are', () => {
    const settled = { ...draft, proposal: proposal(draft, 'p1', 'accepted') }
    expect(withNewWorkLane(draft, settled)).toBe(settled)
    const archived = { ...draft, archived: true, proposal: proposal(draft, 'p1') }
    expect(withNewWorkLane(draft, archived).lane).toBe('review')
  })
})

describe('moveToLane and setArchived', () => {
  it('return the same Draft when nothing changes', () => {
    const draft = { ...v1Draft(), lane: 'review' as const }
    expect(moveToLane(draft, 'review')).toBe(draft)
    expect(moveToLane(draft, 'ready').lane).toBe('ready')
    expect(setArchived(draft, false)).toBe(draft)
    expect(setArchived(draft, true).archived).toBe(true)
  })
})
