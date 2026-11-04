// Tests for how a session receives each of the Draft's Backlog References: in full, in full with what changed,
// or only listed — across every session kind, "include in full" and how far behind the Draft is.
import { describe, expect, it } from 'vitest'

import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import { deliverBacklogReferences } from '#core/backlog/backlogDelivery.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'

const copyAt = (revision: number): BacklogCopy => ({
  id: 'ado-1234',
  workItemId: 1234,
  workItemType: 'Feature',
  title: 'Device archiving',
  content: 'BR1 — changed.',
  ...(revision > 1 ? { previousContent: 'BR1 — original.' } : {}),
  revision,
  pastedAt: '2026-11-04',
})

const LATER: SessionKind[] = ['focused', 'iteration', 'upgrade']

/** How one reference to a Copy at revision 3 is delivered. */
const modeFor = (kind: SessionKind, includeInFull: boolean, seenRevision: number) =>
  deliverBacklogReferences({ kind, includeInFull, references: [{ copy: copyAt(3), seenRevision }] })[0].mode

describe('deliverBacklogReferences', () => {
  it.each([false, true])('gives the first session every Copy in full (include in full: %s)', (includeInFull) => {
    expect(modeFor('first', includeInFull, 3)).toBe('full')
  })

  describe.each(LATER)('a later session (%s)', (kind) => {
    it.each([
      [false, 3, 'listed'],
      [true, 3, 'full'],
      [false, 2, 'full-with-changes'],
      [true, 2, 'full-with-changes'],
      [false, 1, 'full-with-changes'],
      [true, 1, 'full-with-changes'],
    ] as const)('include in full %s, seen revision %i of 3 → %s', (includeInFull, seen, mode) => {
      expect(modeFor(kind, includeInFull, seen)).toBe(mode)
    })
  })

  it('includes what changed when the Draft is exactly one re-paste behind', () => {
    const [delivered] = deliverBacklogReferences({
      kind: 'focused',
      includeInFull: false,
      references: [{ copy: copyAt(3), seenRevision: 2 }],
    })
    expect(delivered).toMatchObject({
      mode: 'full-with-changes',
      changes: 'Description:\n- BR1 — original.\n+ BR1 — changed.',
      missedRepastes: 1,
    })
  })

  it('says how many re-pastes were missed, without a diff, when the Draft is further behind', () => {
    const [delivered] = deliverBacklogReferences({
      kind: 'iteration',
      includeInFull: false,
      references: [{ copy: copyAt(3), seenRevision: 1 }],
    })
    expect(delivered).toMatchObject({ mode: 'full-with-changes', missedRepastes: 2 })
    expect(delivered.changes).toBeUndefined()
  })

  it('decides each reference on its own', () => {
    const other = { ...copyAt(1), id: 'ado-1422', workItemId: 1422 }
    const delivered = deliverBacklogReferences({
      kind: 'focused',
      includeInFull: false,
      references: [
        { copy: copyAt(3), seenRevision: 2 },
        { copy: other, seenRevision: 1 },
      ],
    })
    expect(delivered.map((reference) => [reference.copy.id, reference.mode])).toEqual([
      ['ado-1234', 'full-with-changes'],
      ['ado-1422', 'listed'],
    ])
  })
})
