// Tests for human edits to a Draft and the human-edit markers each edit sets.
import { describe, expect, it } from 'vitest'

import { applyHumanOp, DraftOpError } from '#core/draft/humanOps.ts'
import { classify } from '#core/proposal/classify.ts'
import { sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

describe('Human edits to a Draft', () => {
  it('refuses to Discard a Locked Section but lets the human edit and move it', () => {
    const draft = v1Draft()
    const story = sectionByKey(draft, 'userStory')
    expect(() => applyHumanOp(draft, { op: 'discardSection', sectionId: story.id })).toThrow(DraftOpError)
    const moved = applyHumanOp(draft, { op: 'moveSection', sectionId: story.id, toIndex: 3 })
    expect(moved.sections[3].id).toBe(story.id)
    const edited = applyHumanOp(moved, { op: 'editSection', sectionId: story.id, body: 'As a Manager, I want…' })
    expect(sectionByKey(edited, 'userStory')).toMatchObject({ humanEdited: true, humanMoved: true })
  })

  it('makes a later change to a Section the human moved a Conflict', () => {
    const draft = v1Draft()
    const tech = sectionByKey(draft, 'technicalNotes')
    const moved = applyHumanOp(draft, { op: 'moveSection', sectionId: tech.id, toIndex: 0 })
    expect(classify(moved, [{ kind: 'replaceSection', sectionId: tech.id, body: 'New notes' }])[0]).toMatchObject({
      conflict: true,
      conflictReason: 'You moved this',
    })
  })

  it('keeps Discarded content in the Draft so it can be restored', () => {
    const draft = v1Draft()
    const design = sectionByKey(draft, 'design')
    const discarded = applyHumanOp(draft, { op: 'discardSection', sectionId: design.id })
    expect(sectionByKey(discarded, 'design')).toMatchObject({ discarded: true, body: design.body })
    expect(
      sectionByKey(applyHumanOp(discarded, { op: 'restoreSection', sectionId: design.id }), 'design').discarded,
    ).toBe(false)
  })
})
