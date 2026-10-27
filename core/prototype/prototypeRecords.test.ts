// Tests for the Prototype lists' rows: one row per Prototype and per unfinished session, newest first, and the row
// schema as a discriminated union on `kind`.
import { describe, expect, it } from 'vitest'

import {
  type Prototype,
  prototypeRows,
  prototypeRowSchema,
  type PrototypeSession,
  prototypeSummaryOf,
} from './prototypeRecords.ts'

const prototype = (id: string, writtenAt: string): Prototype => ({
  id,
  projectId: 'p',
  draftId: 'd',
  draftVersion: 1,
  writtenAt,
  images: [],
  assumptions: [{ choice: 'a', why: 'b' }],
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
