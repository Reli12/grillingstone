// Tests for the Prototype Grilling Session record and what lists and live events show of it: the record reads back as
// written, with or without a Draft; its summary leaves out messages and inputs; a running session is a row of the
// Prototype lists and an ended one is not (its Prototypes are).
import { describe, expect, it } from 'vitest'

import {
  chainOfContinuation,
  nextRoundOf,
  type Prototype,
  type PrototypeGrillingSession,
  prototypeGrillingSessionSchema,
  prototypeGrillingSummaryOf,
  prototypeRows,
  prototypeRowSchema,
  workFolderIdOf,
} from './prototypeRecords.ts'

const grilling = (
  id: string,
  status: PrototypeGrillingSession['status'],
  startedAt: string,
): PrototypeGrillingSession => ({
  id,
  kind: 'prototypeGrilling',
  projectId: 'p',
  draft: { draftId: 'd', draftVersion: 2 },
  status,
  writeConfirmed: false,
  startedAt,
  inputs: { tickedImages: [], extraImages: [] },
  prototypeIds: [],
  messages: [],
})

const prototype = (id: string, writtenAt: string): Prototype => ({
  id,
  projectId: 'p',
  writtenBy: { kind: 'prototypeGrilling', sessionId: 'pg-1', round: 1 },
  writtenAt,
  images: [],
  assumptions: [{ choice: 'a', why: 'b' }],
})

describe('the Prototype Grilling Session record', () => {
  it('reads back a record it wrote, started from a Draft or from none', () => {
    const fromDraft = grilling('pg-1', 'waiting', '2026-10-27T10:00:00Z')
    expect(prototypeGrillingSessionSchema.parse(fromDraft)).toEqual(fromDraft)
    const { draft: _draft, ...draftLess } = fromDraft
    const parsed = prototypeGrillingSessionSchema.parse(draftLess)
    expect(parsed).toEqual(draftLess)
    expect(parsed.draft).toBeUndefined()
  })

  it('keeps the ids of its Prototypes in order, the starting Prototype and the session it continues', () => {
    const record = {
      ...grilling('pg-2', 'finished', '2026-10-27T10:00:00Z'),
      prototypeIds: ['proto-b', 'proto-a'],
      inputs: { tickedImages: [], extraImages: [], startingPrototypeId: 'proto-0' },
      continues: 'pg-1',
    }
    const parsed = prototypeGrillingSessionSchema.parse(record)
    expect(parsed.prototypeIds).toEqual(['proto-b', 'proto-a'])
    expect(parsed.inputs.startingPrototypeId).toBe('proto-0')
    expect(parsed.continues).toBe('pg-1')
  })

  it('has the Draft id and the version together, or neither', () => {
    const { draft: _draft, ...rest } = grilling('pg-1', 'waiting', '2026-10-27T10:00:00Z')
    expect(prototypeGrillingSessionSchema.safeParse({ ...rest, draft: { draftId: 'd' } }).success).toBe(false)
  })

  it('refuses a record of another kind', () => {
    const record = { ...grilling('pg-1', 'waiting', '2026-10-27T10:00:00Z'), kind: 'prototype' }
    expect(prototypeGrillingSessionSchema.safeParse(record).success).toBe(false)
  })
})

describe('the summary of a Prototype Grilling Session', () => {
  it('leaves out the messages and the inputs and keeps the rest', () => {
    const record = {
      ...grilling('pg-1', 'finished', '2026-10-27T10:00:00Z'),
      endedAt: '2026-10-27T11:00:00Z',
      prototypeIds: ['proto-1'],
      inputs: { tickedImages: [], extraImages: [], startingPrototypeId: 'proto-0' },
    }
    expect(prototypeGrillingSummaryOf(record)).toEqual({
      id: 'pg-1',
      kind: 'prototypeGrilling',
      projectId: 'p',
      draft: { draftId: 'd', draftVersion: 2 },
      status: 'finished',
      startedAt: '2026-10-27T10:00:00Z',
      endedAt: '2026-10-27T11:00:00Z',
      startingPrototypeId: 'proto-0',
      prototypeIds: ['proto-1'],
    })
  })

  it('keeps the error of a failed session and the session it continues', () => {
    const record = {
      ...grilling('pg-2', 'failed', '2026-10-27T10:00:00Z'),
      error: 'Claude exited',
      continues: 'pg-1',
    }
    expect(prototypeGrillingSummaryOf(record)).toMatchObject({ error: 'Claude exited', continues: 'pg-1' })
    expect(prototypeGrillingSummaryOf(grilling('pg-3', 'failed', '2026-10-27T10:00:00Z'))).not.toHaveProperty('error')
  })

  it("carries Claude's step while the session is live, and none once it ended", () => {
    const wrote = { id: 'm', at: 'x', role: 'tool' as const, tool: 'Write', summary: 'Wrote prototype.html' }
    const live = { ...grilling('pg-1', 'thinking', '2026-10-27T10:00:00Z'), messages: [wrote] }
    expect(prototypeGrillingSummaryOf(live).step).toBe('writing')
    expect(prototypeGrillingSummaryOf({ ...live, status: 'stopped' }).step).toBeUndefined()
  })

  it('carries no step while the session waits for the human, after a round or before the first one', () => {
    const wrote = { id: 'm', at: 'x', role: 'tool' as const, tool: 'Write', summary: 'Wrote prototype.html' }
    const waiting = { ...grilling('pg-1', 'waiting', '2026-10-27T10:00:00Z'), messages: [wrote] }
    expect(prototypeGrillingSummaryOf(waiting)).not.toHaveProperty('step')
  })

  it('starts each turn without the step of the last one', () => {
    const wrote = { id: 'm1', at: 'x', role: 'tool' as const, tool: 'Write', summary: 'Wrote prototype.html' }
    const said = { id: 'm2', at: 'x', role: 'human' as const, kind: 'message' as const, text: 'Make it red' }
    const live = { ...grilling('pg-1', 'thinking', '2026-10-27T10:00:00Z'), messages: [wrote, said] }
    expect(prototypeGrillingSummaryOf(live)).not.toHaveProperty('step')
    const editing = { id: 'm3', at: 'x', role: 'tool' as const, tool: 'Edit', summary: 'Wrote prototype.html' }
    expect(prototypeGrillingSummaryOf({ ...live, messages: [...live.messages, editing] }).step).toBe('editing')
  })

  it('does not say Claude reads the Draft when the session has none', () => {
    const read = { id: 'm1', at: 'x', role: 'tool' as const, tool: 'Read', summary: 'Read glossary.md' }
    const { draft: _draft, ...draftLess } = grilling('pg-1', 'thinking', '2026-10-27T10:00:00Z')
    expect(prototypeGrillingSummaryOf({ ...draftLess, messages: [read] })).not.toHaveProperty('step')
    expect(prototypeGrillingSummaryOf({ ...grilling('pg-2', 'thinking', 'x'), messages: [read] }).step).toBe('reading')
  })
})

describe('the chain of a Prototype Grilling Session and its Continuations', () => {
  it('works in the folder of the first session of its chain, and of itself when it is the first', () => {
    const first = grilling('pg-1', 'finished', '2026-10-27T10:00:00Z')
    expect(workFolderIdOf(first)).toBe('pg-1')
    expect(workFolderIdOf({ ...first, id: 'pg-2', chainId: 'pg-1' })).toBe('pg-1')
  })

  it('numbers the next round after the rounds of the whole chain', () => {
    const first = grilling('pg-1', 'finished', '2026-10-27T10:00:00Z')
    expect(nextRoundOf(first)).toBe(1)
    expect(nextRoundOf({ ...first, prototypeIds: ['a', 'b'] })).toBe(3)
    expect(nextRoundOf({ ...first, priorRounds: 2, prototypeIds: ['c'] })).toBe(4)
  })

  it('hands a Continuation the chain and the rounds written so far', () => {
    const first = { ...grilling('pg-1', 'finished', '2026-10-27T10:00:00Z'), prototypeIds: ['a', 'b'] }
    expect(chainOfContinuation(first)).toEqual({ chainId: 'pg-1', priorRounds: 2 })
    const second = { ...grilling('pg-2', 'finished', 'x'), chainId: 'pg-1', priorRounds: 2, prototypeIds: ['c'] }
    expect(chainOfContinuation(second)).toEqual({ chainId: 'pg-1', priorRounds: 3 })
  })

  it('keeps the chain on the record', () => {
    const record = { ...grilling('pg-2', 'finished', 'x'), chainId: 'pg-1', priorRounds: 2 }
    expect(prototypeGrillingSessionSchema.parse(record)).toEqual(record)
  })
})

describe('Prototype Grilling Sessions in the Prototype lists', () => {
  it('shows a live session as a running row among the other rows, newest first', () => {
    const rows = prototypeRows(
      [prototype('proto-1', '2026-10-27T09:00:00Z')],
      [],
      [grilling('pg-run', 'waiting', '2026-10-27T10:00:00Z')],
    )
    expect(rows.map((row) => row.kind)).toEqual(['runningGrilling', 'finished'])
    expect(rows[0]).toMatchObject({ session: { id: 'pg-run', kind: 'prototypeGrilling' } })
  })

  it('shows a session that ended after writing Prototypes only through its Prototypes', () => {
    const ended = ['finished', 'stopped', 'failed', 'interrupted'] as const
    const sessions = ended.map((status) => ({
      ...grilling(`pg-${status}`, status, '2026-10-27T10:00:00Z'),
      prototypeIds: ['proto-1'],
    }))
    expect(prototypeRows([], [], sessions)).toEqual([])
  })

  it('shows a session that ended without writing a Prototype as a row of its own', () => {
    const ended = ['finished', 'stopped', 'failed', 'interrupted'] as const
    const sessions = ended.map((status, i) => grilling(`pg-${status}`, status, `2026-10-27T10:0${i}:00Z`))
    const rows = prototypeRows([], [], sessions)
    expect(rows.map((row) => row.kind)).toEqual(['endedGrilling', 'endedGrilling', 'endedGrilling', 'endedGrilling'])
    expect(rows.map((row) => (row.kind === 'endedGrilling' ? row.session.id : undefined))).toEqual([
      'pg-interrupted',
      'pg-failed',
      'pg-stopped',
      'pg-finished',
    ])
    for (const row of rows) expect(prototypeRowSchema.parse(row)).toEqual(row)
  })

  it('shows a running session that started from no Draft', () => {
    const { draft: _draft, ...draftLess } = grilling('pg-run', 'thinking', '2026-10-27T10:00:00Z')
    const [row] = prototypeRows([], [], [draftLess])
    expect(row.kind).toBe('runningGrilling')
    expect(row.kind === 'runningGrilling' && row.session.draft).toBeUndefined()
  })

  it('lists the rows it already listed when no Prototype Grilling Session is given', () => {
    expect(prototypeRows([prototype('proto-1', '2026-10-27T09:00:00Z')], []).map((row) => row.kind)).toEqual([
      'finished',
    ])
  })

  it('parses the running row of a session', () => {
    const [row] = prototypeRows([], [], [grilling('pg-run', 'writing', '2026-10-27T10:00:00Z')])
    expect(prototypeRowSchema.parse(row)).toEqual(row)
  })
})
