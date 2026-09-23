import { describe, expect, it } from 'vitest'
import { openProposal } from '#core/proposal/classify.ts'
import { applyHumanEdit } from '#core/proposal/humanEdit.ts'
import { acceptAllClean, decide, finalize } from '#core/proposal/triage.ts'
import { acOf, meta, rewriteAc02, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

/** v1 with AC02 hand-edited, then a Proposal: one Clean add, one Clean rewrite of AC01, one Conflict on AC02. */
const triageScenario = () => {
  let draft = v1Draft()
  const ac = acOf(draft)
  draft = applyHumanEdit(draft, { op: 'editEntry', sectionId: ac.id, entryId: ac.entries[1].id, body: 'Given my wording\nThen mine' })
  const deps = sectionByKey(draft, 'dependencies')
  draft = openProposal(
    draft,
    [
      { kind: 'addEntry', sectionId: deps.id, title: 'Backend API must provide', body: 'POST /devices/archive (bulk)' },
      { kind: 'replaceEntry', sectionId: ac.id, entryId: ac.entries[0].id, body: 'Given a Manager views active devices\nWhen they archive one or more\nThen they disappear from dashboards' },
      rewriteAc02(draft),
    ],
    { sessionId: 'sess-1', kind: 'focused', now: meta.date },
  )
  const [add, cleanRewrite, conflict] = draft.proposal!.changes
  return { draft, add, cleanRewrite, conflict }
}

describe('Proposal Engine — triage', () => {
  it('accepts every Clean Change in one go and leaves Conflicts pending', () => {
    const { draft, conflict } = triageScenario()
    const next = acceptAllClean(draft, meta)
    expect(next.proposal!.changes.map((c) => c.status)).toEqual(['accepted', 'accepted', 'pending'])
    expect(sectionByKey(next, 'dependencies').entries.map((e) => e.body)).toContain('POST /devices/archive (bulk)')
    expect(acOf(next).entries[0].body).toContain('one or more')
    expect(acOf(next).entries[1].body).toBe('Given my wording\nThen mine')
    expect(next.version).toBe(1)
    expect(finalize(next, meta)).toBeNull()
    expect(conflict.conflict).toBe(true)
  })

  it('creates the next Iteration with an Iteration Log line once nothing is pending', () => {
    const { draft, conflict } = triageScenario()
    const next = decide(acceptAllClean(draft, meta), conflict.id, true, meta)
    expect(next.version).toBe(2)
    expect(next.proposal).toBeNull()
    expect(next.iterationLog.at(-1)).toEqual({ version: 2, date: meta.date, author: meta.author, note: '3 changes accepted from a Focused Session' })
    expect(acOf(next).entries[1]).toMatchObject({ body: expect.stringContaining('each archive timestamp'), humanEdited: false })
  })

  it('leaves the Draft untouched by rejected changes, and makes no Iteration when everything is rejected', () => {
    const { draft, add, cleanRewrite, conflict } = triageScenario()
    let next = decide(draft, add.id, false, meta)
    next = decide(next, cleanRewrite.id, false, meta)
    next = decide(next, conflict.id, false, meta)
    expect(next.sections).toEqual(draft.sections)
    expect(next.version).toBe(1)
    expect(next.iterationLog).toEqual(draft.iterationLog)
    expect(next.proposal).toBeNull()
  })

  it('brings back a Discarded Entry only when the human accepts the Conflict', () => {
    let draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    draft = applyHumanEdit(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
    draft = openProposal(draft, [{ kind: 'restore', sectionId: oq.id, entryId: oq.entries[1].id }], { sessionId: 's', kind: 'iteration', now: meta.date })
    expect(acceptAllClean(draft, meta).proposal!.changes[0].status).toBe('pending')
    const next = decide(draft, draft.proposal!.changes[0].id, true, meta)
    expect(sectionByKey(next, 'openQuestions').entries[1].discarded).toBe(false)
  })

  it('turns a pending Clean Change into a Conflict when the human edits its target mid-triage', () => {
    const { draft, cleanRewrite } = triageScenario()
    const ac = acOf(draft)
    const next = applyHumanEdit(draft, { op: 'editEntry', sectionId: ac.id, entryId: ac.entries[0].id, body: 'Given I changed my mind\nThen mine' })
    expect(next.proposal!.changes.find((c) => c.id === cleanRewrite.id)).toMatchObject({ conflict: true, before: expect.stringContaining('I changed my mind') })
  })
})
