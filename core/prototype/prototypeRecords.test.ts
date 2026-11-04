// Tests for the Prototype record and the Prototype lists' rows: a Draft link that is a pair or absent, who wrote the
// Prototype (records from before Prototype Grilling Sessions still read), one row per Prototype and per unfinished
// session, newest first, and the row schema as a discriminated union on `kind`.
import { describe, expect, it } from 'vitest'

import {
  type Prototype,
  prototypeRows,
  prototypeRowSchema,
  prototypeSchema,
  type PrototypeSession,
  prototypeSummaryOf,
} from './prototypeRecords.ts'

const prototype = (id: string, writtenAt: string): Prototype => ({
  id,
  projectId: 'p',
  draft: { draftId: 'd', draftVersion: 1 },
  writtenBy: { kind: 'prototype', sessionId: 's' },
  writtenAt,
  images: [],
  assumptions: [{ choice: 'a', why: 'b' }],
})

/** A Prototype record as the first Prototypes build wrote it: flat Draft fields, and no writer. */
const olderRecord = {
  id: 'proto-old',
  projectId: 'p',
  draftId: 'd-old',
  draftVersion: 2,
  writtenAt: '2026-10-20T10:00:00Z',
  startingPrototypeId: 'proto-0',
  images: [{ number: 1, mediaType: 'image/png', source: 'Added on the start form' }],
  assumptions: [{ choice: 'a', why: 'b' }],
}

describe('the Prototype record', () => {
  it('reads a record written before Prototype Grilling Sessions as written by a Prototype Session on its Draft', () => {
    expect(prototypeSchema.parse(olderRecord)).toEqual({
      id: 'proto-old',
      projectId: 'p',
      draft: { draftId: 'd-old', draftVersion: 2 },
      writtenBy: { kind: 'prototype' },
      writtenAt: '2026-10-20T10:00:00Z',
      startingPrototypeId: 'proto-0',
      images: olderRecord.images,
      assumptions: olderRecord.assumptions,
    })
  })

  it('reads back a record it wrote, whether it has a Draft or not', () => {
    const withDraft = prototype('a', '2026-10-01T10:00:00Z')
    expect(prototypeSchema.parse(withDraft)).toEqual(withDraft)
    const { draft: _draft, ...rest } = withDraft
    expect(prototypeSchema.parse(rest)).toEqual(rest)
    expect(prototypeSchema.parse(rest).draft).toBeUndefined()
  })

  it('has the Draft id and the version together, or neither', () => {
    const { draft: _draft, ...rest } = prototype('a', '2026-10-01T10:00:00Z')
    expect(prototypeSchema.safeParse({ ...rest, draft: { draftId: 'd' } }).success).toBe(false)
    expect(prototypeSchema.safeParse({ ...rest, draft: { draftVersion: 1 } }).success).toBe(false)
    // An older record with only one of the two flat fields is not a Draft-less Prototype.
    const { draftVersion: _version, ...idOnly } = olderRecord
    expect(prototypeSchema.safeParse(idOnly).success).toBe(false)
    const { draftId: _id, ...versionOnly } = olderRecord
    expect(prototypeSchema.safeParse(versionOnly).success).toBe(false)
  })

  it('records the session and round of a Prototype Grilling Session', () => {
    const { draft: _draft, ...rest } = prototype('a', '2026-10-01T10:00:00Z')
    const written = { ...rest, writtenBy: { kind: 'prototypeGrilling', sessionId: 'pg-1', round: 2 } }
    expect(prototypeSchema.parse(written).writtenBy).toEqual({ kind: 'prototypeGrilling', sessionId: 'pg-1', round: 2 })
  })

  it('needs the session and the round of a Prototype Grilling Session, and knows no other kind', () => {
    const base = prototype('a', '2026-10-01T10:00:00Z')
    const noRound = { ...base, writtenBy: { kind: 'prototypeGrilling', sessionId: 'pg-1' } }
    const noSession = { ...base, writtenBy: { kind: 'prototypeGrilling', round: 1 } }
    const unknown = { ...base, writtenBy: { kind: 'grilling', sessionId: 'g-1' } }
    for (const record of [noRound, noSession, unknown]) expect(prototypeSchema.safeParse(record).success).toBe(false)
  })

  it('refuses a round below 1', () => {
    const written = {
      ...prototype('a', '2026-10-01T10:00:00Z'),
      writtenBy: { kind: 'prototypeGrilling', sessionId: 'pg-1', round: 0 },
    }
    expect(prototypeSchema.safeParse(written).success).toBe(false)
  })
})

const session = (id: string, status: PrototypeSession['status'], startedAt: string): PrototypeSession => ({
  id,
  kind: 'prototype',
  projectId: 'p',
  draftId: 'd',
  draftVersion: 1,
  status,
  writeConfirmed: true,
  startedAt,
  inputs: { tickedImages: [], extraImages: [] },
  messages: [],
})

describe('prototypeRows', () => {
  it('lists Prototypes and unfinished sessions together, newest first', () => {
    const rows = prototypeRows(
      [prototype('old', '2026-10-01T10:00:00Z'), prototype('new', '2026-10-03T10:00:00Z')],
      [session('s-run', 'thinking', '2026-10-04T10:00:00Z'), session('s-fail', 'failed', '2026-10-02T10:00:00Z')],
    )
    expect(rows.map((row) => row.kind)).toEqual(['running', 'finished', 'failed', 'finished'])
    expect(rows.map((row) => (row.kind === 'finished' ? row.prototype.id : row.session.id))).toEqual([
      's-run',
      'new',
      's-fail',
      'old',
    ])
  })

  it('shows a finished session as its Prototype only, and a stopped one as stopped', () => {
    const rows = prototypeRows(
      [],
      [session('s1', 'finished', '2026-10-01T10:00:00Z'), session('s2', 'stopped', '2026-10-02T10:00:00Z')],
    )
    expect(rows.map((row) => row.kind)).toEqual(['stopped'])
  })

  it('gives a Failed row its messages for Details', () => {
    const failed = { ...session('s', 'failed', '2026-10-01T10:00:00Z'), error: 'boom' }
    failed.messages.push({ id: 'm', at: failed.startedAt, role: 'system', text: 'boom', tone: 'error' })
    const [row] = prototypeRows([], [failed])
    expect(row).toMatchObject({ kind: 'failed', session: { error: 'boom' }, messages: [{ text: 'boom' }] })
  })

  it('shows a session interrupted in an older build as Failed', () => {
    expect(prototypeRows([], [session('s', 'interrupted', '2026-10-01T10:00:00Z')])[0].kind).toBe('failed')
  })
})

describe('the row schema', () => {
  it('parses every row the lists produce', () => {
    const rows = prototypeRows(
      [prototype('a', '2026-10-01T10:00:00Z')],
      [session('r', 'writing', '2026-10-02T10:00:00Z'), session('f', 'failed', '2026-10-03T10:00:00Z')],
    )
    for (const row of rows) expect(prototypeRowSchema.parse(row)).toEqual(row)
  })

  it('carries the kind of session that wrote a finished row, and its Draft when it has one', () => {
    const { draft: _draft, ...sketch } = {
      ...prototype('sketch', '2026-10-02T10:00:00Z'),
      writtenBy: { kind: 'prototypeGrilling' as const, sessionId: 'pg-1', round: 1 },
    }
    const rows = prototypeRows([prototype('drafted', '2026-10-01T10:00:00Z'), sketch], [])
    for (const row of rows) expect(prototypeRowSchema.parse(row)).toEqual(row)
    expect(rows.map((row) => (row.kind === 'finished' ? row.prototype.writtenBy.kind : undefined))).toEqual([
      'prototypeGrilling',
      'prototype',
    ])
    expect(rows.map((row) => (row.kind === 'finished' ? row.prototype.draft?.draftId : undefined))).toEqual([
      undefined,
      'd',
    ])
  })

  it('reads a finished row whose Prototype is an older record', () => {
    const row = prototypeRowSchema.parse({ kind: 'finished', prototype: olderRecord })
    expect(row).toMatchObject({
      kind: 'finished',
      prototype: { draft: { draftId: 'd-old', draftVersion: 2 }, writtenBy: { kind: 'prototype' } },
    })
  })

  it('refuses a row of an unknown kind', () => {
    expect(prototypeRowSchema.safeParse({ kind: 'paused' }).success).toBe(false)
  })

  it('summarises a session without its messages and inputs', () => {
    const summary = prototypeSummaryOf({ ...session('s', 'finished', '2026-10-01T10:00:00Z'), prototypeId: 'proto-1' })
    expect(summary).toEqual({
      id: 's',
      kind: 'prototype',
      projectId: 'p',
      draftId: 'd',
      draftVersion: 1,
      status: 'finished',
      startedAt: '2026-10-01T10:00:00Z',
      prototypeId: 'proto-1',
    })
  })
})
