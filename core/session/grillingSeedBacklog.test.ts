// Tests for the Backlog References block of a Grilling Session's seed: in full for v1, listed with a path later,
// with what changed after a re-paste, and the "which part" opening when the requirement was left empty.
import { describe, expect, it } from 'vitest'

import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import { newDraft } from '#core/draft/draft.ts'
import { buildSeed, type SeedInput } from '#core/session/grillingSeed.ts'
import { defaultPbiTemplate, meta, v1Draft } from '#core/testing/fixtures.ts'

const feature: BacklogCopy = {
  id: 'ado-1234',
  workItemId: 1234,
  workItemType: 'Feature',
  title: 'Device archiving',
  content: 'BR1 — A Manager can archive a device.',
  acceptanceCriteria: 'AC1 — Archived devices leave dashboards.',
  revision: 2,
  pastedAt: '2026-11-04',
}
const PATH = 'backlog-copies/ado-1234.md'

const firstDraft = (requirement: string) =>
  newDraft({ projectId: 'p', workItemType: 'PBI', template: defaultPbiTemplate, requirement, now: meta.date })

function seedOf(overrides: Partial<SeedInput>) {
  const seed = buildSeed({
    kind: 'focused',
    draft: v1Draft(),
    projectName: 'P',
    glossary: '',
    references: [],
    submitCommand: 'node submit',
    payloadFile: '.submit/s.json',
    focus: { sectionId: v1Draft().sections[0].id },
    ...overrides,
  })
  return seed.firstMessage
}

describe('Backlog References in the seed', () => {
  it('gives the first session each Copy in full, Acceptance Criteria included, as context with no obligation', () => {
    const message = seedOf({
      kind: 'first',
      draft: firstDraft('Archive from the device page.'),
      focus: undefined,
      backlogReferences: [{ copy: feature, mode: 'full', path: PATH }],
    })
    expect(message).toContain('## Backlog References')
    expect(message).toContain('### Feature #1234: Device archiving')
    expect(message).toContain(feature.content)
    expect(message).toContain(feature.acceptanceCriteria)
    expect(message).toContain('no obligation')
    expect(message).not.toContain('Which part')
  })

  it('only lists a Copy for a later session, with where to read it and when it must be read', () => {
    const message = seedOf({ backlogReferences: [{ copy: feature, mode: 'listed', path: PATH }] })
    expect(message).toContain(`- Feature #1234: Device archiving — read ${PATH}`)
    expect(message).not.toContain(feature.content)
    expect(message).toMatch(/always before changing content that cites one of its business rules/)
  })

  it('gives a re-pasted Copy in full together with what changed', () => {
    const message = seedOf({
      backlogReferences: [
        { copy: feature, mode: 'full-with-changes', missedRepastes: 1, changes: '- BR1 — old.', path: PATH },
      ],
    })
    expect(message).toContain("Changed since this Draft's last session:\n- BR1 — old.")
    expect(message).toContain(feature.content)
    expect(message).not.toMatch(/always before changing/)
  })

  it('says the Copy was re-pasted several times when there is no single diff to show', () => {
    const message = seedOf({
      backlogReferences: [{ copy: feature, mode: 'full-with-changes', missedRepastes: 3, path: PATH }],
    })
    expect(message).toContain("re-pasted 3 times since this Draft's last session")
    expect(message).toContain(feature.content)
  })

  it('opens the first session by asking which part this Draft covers when the requirement was left empty', () => {
    const message = seedOf({
      kind: 'first',
      draft: firstDraft(''),
      focus: undefined,
      backlogReferences: [{ copy: feature, mode: 'full', path: PATH }],
    })
    expect(message).toMatch(/first question: which part of .*Feature #1234.* this PBI covers/i)
  })

  it('adds no Backlog References block when the Draft has none', () => {
    expect(seedOf({})).not.toContain('Backlog References')
    expect(seedOf({ backlogReferences: [] })).not.toContain('Backlog References')
  })
})
