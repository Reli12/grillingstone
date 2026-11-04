// Tests for the downloaded file's name: the pattern, the safe title and the local time.
import { describe, expect, it } from 'vitest'

import { prototypeFileName, safeFileTitle } from './prototypeFileName.ts'

// Built from local parts, so the expectation does not depend on the machine's time zone.
const writtenAt = new Date(2026, 9, 25, 14, 5).toISOString()

describe('prototypeFileName', () => {
  it('names the Draft, its version and the time written', () => {
    expect(prototypeFileName({ draftTitle: 'Archive device', draftVersion: 3, writtenAt })).toBe(
      'Archive device – v3 – 2026-10-25 14.05.html',
    )
  })

  it('names a Prototype of no Draft by the time written only', () => {
    expect(prototypeFileName({ writtenAt })).toBe('Prototype – 2026-10-25 14.05.html')
  })

  it('makes the title safe for file names', () => {
    expect(safeFileTitle('A/B: "Archive" <devices>?  now*')).toBe('A B Archive devices now')
    expect(safeFileTitle('..hidden..')).toBe('hidden')
    expect(safeFileTitle('x'.repeat(300))).toHaveLength(100)
  })

  it('has a name for a Draft without a title', () => {
    expect(safeFileTitle('  ')).toBe('Untitled Draft')
    expect(prototypeFileName({ draftTitle: '/', draftVersion: 1, writtenAt })).toMatch(/^Untitled Draft – v1 – /)
  })

  it('keeps letters beyond ASCII', () => {
    expect(safeFileTitle('Arhiviranje naprav – čšž')).toBe('Arhiviranje naprav – čšž')
  })
})
