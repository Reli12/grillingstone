// Tests for the Prototype context a Grilling Session may read: source, assumptions marked unsettled, Images numbered
// after the session's own, deleted Prototypes noted, and never a Transcript.
import { describe, expect, it } from 'vitest'

import { buildPrototypeContext, type ContextEntry, type ContextPrototype } from '#core/prototype/prototypeContext.ts'

const prototype = (patch: Partial<ContextPrototype> = {}): ContextEntry => ({
  kind: 'prototype',
  id: 'p1',
  writtenAt: '2026-10-25T10:04:00.000Z',
  draftVersion: 2,
  html: '<main>Bulk archive</main>',
  assumptions: [{ choice: 'Archive lives in a toolbar', why: 'No Image showed it' }],
  images: [],
  ...patch,
})

const image = (number: number, source = 'Added on the start form') => ({
  number,
  mediaType: 'image/png' as const,
  data: `data-${number}`,
  source,
})

describe('buildPrototypeContext', () => {
  it('is empty when no Prototype was given', () => {
    expect(buildPrototypeContext({ entries: [], firstImageNumber: 1 })).toEqual({ markdown: '', images: [] })
  })

  it('renders the HTML source of each Prototype under a numbered heading', () => {
    const { markdown } = buildPrototypeContext({
      entries: [prototype(), prototype({ id: 'p2', html: '<main>Second</main>' })],
      firstImageNumber: 1,
    })
    expect(markdown).toContain('### Prototype 1')
    expect(markdown).toContain('<main>Bulk archive</main>')
    expect(markdown).toContain('### Prototype 2')
    expect(markdown).toContain('<main>Second</main>')
  })

  it('names the Draft version a Prototype was built from, or that it had no Draft', () => {
    const { markdown } = buildPrototypeContext({
      entries: [prototype(), prototype({ id: 'p2', draftVersion: undefined })],
      firstImageNumber: 1,
    })
    expect(markdown).toContain('built from Draft v2')
    expect(markdown).toContain('built from no Draft')
  })

  it('lists the assumptions under a heading that marks them unsettled', () => {
    const { markdown } = buildPrototypeContext({ entries: [prototype()], firstImageNumber: 1 })
    expect(markdown).toMatch(/Assumptions[^\n]*unsettled/i)
    expect(markdown).toContain('- Archive lives in a toolbar: No Image showed it')
  })

  it('says so when a Prototype lists no assumptions', () => {
    const { markdown } = buildPrototypeContext({ entries: [prototype({ assumptions: [] })], firstImageNumber: 1 })
    expect(markdown).toContain('lists no assumptions')
  })

  it('numbers the Images of every Prototype from the first free number, in order', () => {
    const result = buildPrototypeContext({
      entries: [prototype({ images: [image(1), image(2)] }), prototype({ id: 'p2', images: [image(1)] })],
      firstImageNumber: 4,
    })
    expect(result.images.map(({ number, data }) => [number, data])).toEqual([
      [4, 'data-1'],
      [5, 'data-2'],
      [6, 'data-1'],
    ])
  })

  it('maps the images/N of a Prototype source to the number the Image has in this session', () => {
    const { markdown } = buildPrototypeContext({
      entries: [prototype({ images: [image(3, 'Grilling Session of 2026-10-01, Image 2')] })],
      firstImageNumber: 7,
    })
    expect(markdown).toContain('images/3 is Image 7')
    expect(markdown).toContain('Grilling Session of 2026-10-01, Image 2')
  })

  it('never collides with the numbers the session already uses', () => {
    const { images } = buildPrototypeContext({
      entries: [prototype({ images: [image(1), image(2)] })],
      firstImageNumber: 3,
    })
    const taken = new Set([1, 2])
    expect(images.some((candidate) => taken.has(candidate.number))).toBe(false)
  })

  it('skips a deleted Prototype with a note, and still numbers the others', () => {
    const result = buildPrototypeContext({
      entries: [{ kind: 'deleted', id: 'gone' }, prototype({ images: [image(1)] })],
      firstImageNumber: 1,
    })
    expect(result.markdown).toContain('Prototype 1 was deleted')
    expect(result.markdown).toContain('### Prototype 2')
    expect(result.images.map((candidate) => candidate.number)).toEqual([1])
  })

  it('notes a deleted Prototype even when every one given was deleted', () => {
    const result = buildPrototypeContext({ entries: [{ kind: 'deleted', id: 'gone' }], firstImageNumber: 1 })
    expect(result.markdown).toContain('was deleted')
    expect(result.images).toEqual([])
  })

  it('fences a source that itself holds a code fence with a longer one', () => {
    const { markdown } = buildPrototypeContext({
      entries: [prototype({ html: '<pre>```</pre>' })],
      firstImageNumber: 1,
    })
    expect(markdown).toContain('````html')
  })

  it('carries nothing but the Prototype itself: no conversation of the session that wrote it', () => {
    const { markdown } = buildPrototypeContext({ entries: [prototype()], firstImageNumber: 1 })
    expect(markdown).not.toMatch(/transcript|human said|claude said/i)
  })
})
