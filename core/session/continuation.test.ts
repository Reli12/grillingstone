import { describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { continuation } from '#core/session/continuation.ts'
import type { SessionSummary } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

const ended = (patch: Partial<SessionSummary>): SessionSummary => ({
  id: 'sess-1',
  projectId: 'customer-portal',
  draftId: 'd1',
  kind: 'iteration',
  status: 'finished',
  writeConfirmed: true,
  startedAt: meta.date,
  claudeSessionId: 'claude-1',
  ...patch,
})

describe('continuation', () => {
  it('keeps writing v1 while there is none', () => {
    const draft = newDraft({
      projectId: 'customer-portal',
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'x',
      now: meta.date,
    })
    expect(continuation(ended({ kind: 'first', status: 'stopped' }), draft, undefined)).toEqual({
      ok: true,
      kind: 'first',
    })
  })

  it('turns a first session into a New Iteration once v1 exists', () => {
    expect(continuation(ended({ kind: 'first' }), v1Draft(), undefined)).toEqual({ ok: true, kind: 'iteration' })
  })

  it('stays focused while the focused part still exists', () => {
    let draft = v1Draft()
    const scope = sectionByKey(draft, 'scope')
    const entryId = scope.entries[0].id
    const focused = ended({ kind: 'focused', focus: { sectionId: scope.id, entryId, heading: 'Scope › x' } })
    expect(continuation(focused, draft, undefined)).toEqual({
      ok: true,
      kind: 'focused',
      focus: { sectionId: scope.id, entryId },
    })
    draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: scope.id, entryId })
    expect(continuation(focused, draft, undefined)).toEqual({ ok: true, kind: 'iteration' })
  })

  it('stays an upgrade only while a newer Template version exists', () => {
    const upgrade = ended({ kind: 'upgrade' })
    expect(continuation(upgrade, v1Draft(), defaultPbiTemplate.version + 1)).toEqual({ ok: true, kind: 'upgrade' })
    expect(continuation(upgrade, v1Draft(), defaultPbiTemplate.version)).toEqual({ ok: true, kind: 'iteration' })
  })

  it('refuses a live session, one Claude Code never named, and a Draft with an open Proposal', () => {
    expect(continuation(ended({ status: 'waiting' }), v1Draft(), undefined)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('still running'),
    })
    expect(continuation(ended({ claudeSessionId: undefined }), v1Draft(), undefined)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('before sessions could be continued'),
    })
    const withProposal = { ...v1Draft(), proposal: { changes: [] } } as unknown as ReturnType<typeof v1Draft>
    expect(continuation(ended({}), withProposal, undefined)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('Triage'),
    })
  })
})
