// Tests for the questions asked of Prototype rows: who a row belongs to, and whether a Draft is being written for.
import { describe, expect, it } from 'vitest'

import type { PrototypeRow } from '#core/prototype/prototypeRecords.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { finishedPrototypes, isWritingFor, rowDraftId, rowId, sessionPrototypes } from '@/lib/prototypeRows'
import { finishedRow, sessionOf } from '@test/mocks/prototypeBackend'

const draft = v1Draft()
const running: PrototypeRow = { kind: 'running', session: sessionOf(draft, { id: 'psess-1' }) }
const stopped: PrototypeRow = { kind: 'stopped', session: sessionOf(draft, { id: 'psess-2', status: 'stopped' }) }
const finished = finishedRow(draft, { id: 'proto-1' })

describe('prototype rows', () => {
  it('names a row by its Prototype or its session, and its Draft', () => {
    expect(rowId(finished)).toBe('proto-1')
    expect(rowId(stopped)).toBe('psess-2')
    expect(rowDraftId(finished)).toBe(draft.id)
    expect(rowDraftId(running)).toBe(draft.id)
  })

  it('is being written for a Draft only while a row of that Draft is running', () => {
    expect(isWritingFor([running, finished], draft.id)).toBe(true)
    expect(isWritingFor([running], 'd-other')).toBe(false)
    expect(isWritingFor([stopped, finished], draft.id)).toBe(false)
  })

  it('keeps only the finished Prototypes', () => {
    expect(finishedPrototypes([running, finished, stopped]).map((prototype) => prototype.id)).toEqual(['proto-1'])
  })

  it('lists a session’s Prototypes in the order of its rounds, leaving out one deleted since', () => {
    const rows = [finishedRow(draft, { id: 'proto-3' }), finishedRow(draft, { id: 'proto-1' }), running]
    expect(sessionPrototypes(rows, ['proto-1', 'proto-2', 'proto-3']).map((prototype) => prototype.id)).toEqual([
      'proto-1',
      'proto-3',
    ])
  })
})
