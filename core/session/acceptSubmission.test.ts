import { describe, expect, it } from 'vitest'
import { newDraft } from '#core/draft/draft.ts'
import { acceptSubmission, type Submission } from '#core/session/acceptSubmission.ts'
import { acOf, defaultPbiTemplate, meta, rewriteAc02, validPbiContent, v1Draft } from '#core/testing/fixtures.ts'

const fresh = () => newDraft({ projectId: 'p', workItemType: 'PBI', template: defaultPbiTemplate, requirement: 'Archive devices', now: meta.date })
const submission = (patch: Partial<Submission>): Submission => ({ kind: 'first', sessionId: 's1', payload: validPbiContent(), meta, now: meta.date, ...patch })

describe('acceptSubmission', () => {
  it('writes v1 from valid content, and refuses content that breaks the Template', () => {
    const ok = acceptSubmission(fresh(), submission({}))
    expect(ok).toMatchObject({ ok: true, draft: { version: 1 }, message: expect.stringContaining('Draft v1 written') })
    const bad = acceptSubmission(fresh(), submission({ payload: { title: 'x', sections: [] } }))
    expect(bad.ok).toBe(false)
  })

  it('refuses a second v1', () => {
    expect(acceptSubmission(v1Draft(), submission({}))).toEqual({ ok: false, reasons: [{ code: 'v1-exists', message: 'v1 already exists.' }] })
  })

  it('opens a Proposal from a later session and counts its Clean Changes and Conflicts', () => {
    const draft = v1Draft()
    const outcome = acceptSubmission(draft, submission({ kind: 'focused', payload: { changes: [rewriteAc02(draft)] } }))
    expect(outcome).toMatchObject({ ok: true, message: 'Proposal written: 1 Clean Change, 0 Conflicts.' })
    if (outcome.ok) expect(outcome.draft.proposal?.changes[0]).toMatchObject({ sectionId: acOf(draft).id })
  })

  it('refuses a Proposal while one is open, and one with bad changes', () => {
    const draft = v1Draft()
    const open = acceptSubmission(draft, submission({ kind: 'iteration', payload: { changes: [rewriteAc02(draft)] } }))
    if (!open.ok) throw new Error('expected a Proposal')
    expect(acceptSubmission(open.draft, submission({ kind: 'iteration', payload: { changes: [rewriteAc02(draft)] } }))).toMatchObject({ ok: false, reasons: [{ code: 'proposal-open' }] })
    expect(acceptSubmission(draft, submission({ kind: 'iteration', payload: null }))).toMatchObject({ ok: false, reasons: [{ code: 'malformed-proposal' }] })
  })
})
