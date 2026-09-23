import { describe, expect, it } from 'vitest'
import { classify } from '#core/proposal/classify.ts'
import { applyHumanEdit } from '#core/proposal/humanEdit.ts'
import { acOf, rewriteAc02, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

describe('Proposal Engine — classify', () => {
  it('treats a change to content the human never touched as a Clean Change', () => {
    const draft = v1Draft()
    const [change] = classify(draft, [rewriteAc02(draft)])
    expect(change).toMatchObject({ conflict: false, status: 'pending' })
  })

  it('makes a change to a hand-edited Entry a Conflict, showing the human version as before', () => {
    let draft = v1Draft()
    draft = applyHumanEdit(draft, { op: 'editEntry', sectionId: acOf(draft).id, entryId: acOf(draft).entries[1].id, body: 'Given my wording\nThen mine' })
    const [change] = classify(draft, [rewriteAc02(draft)])
    expect(change).toMatchObject({ conflict: true, conflictReason: 'You hand-edited this', before: expect.stringContaining('Given my wording') })
  })

  it('makes a change to an Entry the human moved a Conflict', () => {
    let draft = v1Draft()
    draft = applyHumanEdit(draft, { op: 'moveEntry', sectionId: acOf(draft).id, entryId: acOf(draft).entries[1].id, toIndex: 0 })
    const change = { ...rewriteAc02(draft), entryId: acOf(draft).entries[0].id }
    expect(classify(draft, [change])[0]).toMatchObject({ conflict: true, conflictReason: 'You moved this' })
  })

  it('makes a change inside a Discarded Entry or Section a Conflict', () => {
    let draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    const deps = sectionByKey(draft, 'dependencies')
    draft = applyHumanEdit(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
    draft = applyHumanEdit(draft, { op: 'discardSection', sectionId: deps.id })
    const changes = classify(draft, [
      { kind: 'replaceEntry', sectionId: oq.id, entryId: oq.entries[1].id, body: 'Why it matters: bulk archive\nStatus: Open' },
      { kind: 'addEntry', sectionId: deps.id, title: 'Backend API must provide', body: 'POST /devices/archive' },
    ])
    expect(changes.map((c) => [c.conflict, c.conflictReason])).toEqual([
      [true, 'You discarded this'],
      [true, 'You discarded this Section'],
    ])
  })

  it('always makes bringing back something Discarded a Conflict', () => {
    let draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    draft = applyHumanEdit(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
    const [change] = classify(draft, [{ kind: 'restore', sectionId: oq.id, entryId: oq.entries[1].id }])
    expect(change).toMatchObject({ conflict: true, conflictReason: 'You discarded this', before: '(Discarded by you)' })
  })

  it('makes a new Title a Conflict only once the human has retitled the Draft', () => {
    const clean = v1Draft()
    const edited = applyHumanEdit(v1Draft(), { op: 'retitle', title: 'Archive a device' })
    expect(classify(clean, [{ kind: 'retitle', title: 'Archive devices (single and bulk)' }])[0].conflict).toBe(false)
    expect(classify(edited, [{ kind: 'retitle', title: 'Archive devices (single and bulk)' }])[0]).toMatchObject({
      conflict: true,
      before: 'Archive a device',
      after: 'Archive devices (single and bulk)',
    })
  })
})
