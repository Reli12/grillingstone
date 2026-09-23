import { describe, expect, it } from 'vitest'
import type { Draft } from '#core/draft/draftTypes.ts'
import { checkProposal } from '#core/proposal/checkProposal.ts'
import { applyHumanEdit } from '#core/proposal/humanEdit.ts'
import { acOf, rewriteAc02, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

describe('Proposal Engine — refusing a submitted Proposal', () => {
  const codes = (d: Draft, proposed: unknown) => checkProposal(d, proposed).map((r) => r.code)

  it('accepts well-formed changes against existing ids', () => {
    const draft = v1Draft()
    expect(checkProposal(draft, [rewriteAc02(draft)])).toEqual([])
  })

  it('refuses changes pointing at Sections or Entries that do not exist', () => {
    const draft = v1Draft()
    expect(codes(draft, [{ kind: 'replaceSection', sectionId: 's-nope', body: 'x' }, { ...rewriteAc02(draft), entryId: 'e-nope' }])).toEqual(['unknown-target', 'unknown-target'])
  })

  it('refuses to bring back something that is not Discarded', () => {
    const draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    expect(codes(draft, [{ kind: 'restore', sectionId: oq.id, entryId: oq.entries[0].id }])).toEqual(['nothing-to-restore'])
  })

  it('refuses a Proposal whose result would break the Template', () => {
    const draft = v1Draft()
    const story = sectionByKey(draft, 'userStory')
    expect(codes(draft, [{ kind: 'replaceSection', sectionId: story.id, body: '  ' }])).toEqual(['empty-locked-section'])
  })

  it('accepts a Proposal on a Draft whose Sections the human reordered — the order is theirs', () => {
    let draft = v1Draft()
    draft = applyHumanEdit(draft, { op: 'moveSection', sectionId: acOf(draft).id, toIndex: 1 })
    expect(checkProposal(draft, [rewriteAc02(draft)])).toEqual([])
  })

  it('refuses an empty or malformed Proposal', () => {
    const draft = v1Draft()
    expect(codes(draft, [])).toEqual(['empty-proposal'])
    expect(codes(draft, { changes: 'nope' })).toEqual(['malformed-proposal'])
    expect(codes(draft, [{ kind: 'explode' }])).toEqual(['malformed-change'])
  })
})
