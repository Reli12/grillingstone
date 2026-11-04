// Tests for what a Continuation of an ended Prototype Grilling Session becomes: which Prototype it starts from, which
// Draft version it labels with, and when it is refused.
import { describe, expect, it } from 'vitest'

import {
  ALREADY_WRITING_PROTOTYPE,
  DRAFT_GONE,
  prototypeGrillingContinuation,
  type PrototypeGrillingContinuationRequest,
} from '#core/prototype/prototypeContinuation.ts'
import { NOT_CONTINUABLE, STILL_RUNNING } from '#core/session/continuation.ts'

const request = (patch: Partial<PrototypeGrillingContinuationRequest> = {}): PrototypeGrillingContinuationRequest => ({
  earlier: {
    status: 'finished',
    claudeSessionId: 'claude-1',
    draft: { draftId: 'd1', draftVersion: 2 },
    prototypeIds: ['p1', 'p2', 'p3'],
    startingPrototypeId: 'p0',
  },
  currentDraftVersion: 3,
  surviving: ['p0', 'p1', 'p2', 'p3'],
  lockHeld: false,
  ...patch,
})

describe('prototypeGrillingContinuation', () => {
  it('starts from the newest Prototype of the session and labels with the Draft as it is now', () => {
    expect(prototypeGrillingContinuation(request())).toEqual({
      ok: true,
      draft: { draftId: 'd1', draftVersion: 3 },
      startingPrototypeId: 'p3',
    })
  })

  it('skips deleted Prototypes and takes the newest one that survives', () => {
    expect(prototypeGrillingContinuation(request({ surviving: ['p0', 'p1'] }))).toMatchObject({
      ok: true,
      startingPrototypeId: 'p1',
    })
  })

  it('falls back to the original starting Prototype when every Prototype of the session was deleted', () => {
    expect(prototypeGrillingContinuation(request({ surviving: ['p0'] }))).toMatchObject({
      ok: true,
      startingPrototypeId: 'p0',
    })
  })

  it('starts from no Prototype when nothing survives', () => {
    const result = prototypeGrillingContinuation(request({ surviving: [] }))
    expect(result).toEqual({ ok: true, draft: { draftId: 'd1', draftVersion: 3 } })
  })

  it('has no starting Prototype for a session that wrote none and started from none', () => {
    const result = prototypeGrillingContinuation(
      request({
        earlier: { status: 'stopped', claudeSessionId: 'c', prototypeIds: [] },
        currentDraftVersion: undefined,
        surviving: [],
      }),
    )
    expect(result).toEqual({ ok: true })
  })

  it('continues a session that started from no Draft without a Draft link or a lock check', () => {
    const result = prototypeGrillingContinuation(
      request({
        earlier: { status: 'finished', claudeSessionId: 'c', prototypeIds: ['p1'] },
        currentDraftVersion: undefined,
        lockHeld: true,
      }),
    )
    expect(result).toEqual({ ok: true, startingPrototypeId: 'p1' })
  })

  it.each(['stopped', 'failed', 'interrupted'] as const)('continues a %s session', (status) => {
    const result = prototypeGrillingContinuation(request({ earlier: { ...request().earlier, status } }))
    expect(result.ok).toBe(true)
  })

  it.each(['starting', 'thinking', 'waiting', 'writing'] as const)('refuses a session that is %s', (status) => {
    const result = prototypeGrillingContinuation(request({ earlier: { ...request().earlier, status } }))
    expect(result).toEqual({ ok: false, reason: STILL_RUNNING })
  })

  it('refuses a session without a Claude Code conversation to resume', () => {
    const { claudeSessionId: _gone, ...without } = request().earlier
    expect(prototypeGrillingContinuation(request({ earlier: without }))).toEqual({
      ok: false,
      reason: NOT_CONTINUABLE,
    })
  })

  it('is refused while another Prototype-writing session holds the Draft', () => {
    expect(prototypeGrillingContinuation(request({ lockHeld: true }))).toEqual({
      ok: false,
      reason: ALREADY_WRITING_PROTOTYPE,
    })
  })

  it('is refused when the Draft it started from is gone', () => {
    expect(prototypeGrillingContinuation(request({ currentDraftVersion: undefined }))).toEqual({
      ok: false,
      reason: DRAFT_GONE,
    })
  })
})
