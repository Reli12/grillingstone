// Tests for the stdout JSON-lines reader.
import { describe, expect, it } from 'vitest'

import { jsonLines } from './jsonLines.ts'

describe('jsonLines', () => {
  it('parses complete JSON lines across chunks and skips the rest', () => {
    const events: unknown[] = []
    const feed = jsonLines((event) => events.push(event))
    feed('{"a":1}\n{"b"')
    feed(':2}\n\nnot json\n{"c":3')
    expect(events).toEqual([{ a: 1 }, { b: 2 }])
    feed('}\n')
    expect(events).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })
})
