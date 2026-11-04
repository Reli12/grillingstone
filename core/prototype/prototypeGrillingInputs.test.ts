// Tests for Prototype Grilling inputs: what a Prototype Grilling Session's folder holds with or without a Draft, how
// its Images are numbered once across the session, what each round adds, and the 20 MB limit.
import { describe, expect, it } from 'vitest'

import { applyHumanOp } from '#core/draft/humanOps.ts'
import {
  buildPrototypeGrillingInputs,
  buildRoundAdditions,
  type PrototypeGrillingInputs,
  type PrototypeGrillingInputsRequest,
  type RoundAdditionsRequest,
} from '#core/prototype/prototypeGrillingInputs.ts'
import type { InputImage, PrototypeImage } from '#core/prototype/prototypeInputs.ts'
import { PROTOTYPE_IMAGES_TOO_LARGE, SESSION_IMAGE_WARNING_BYTES } from '#core/session/images.ts'
import { sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

const png = (data: string, source: string): PrototypeImage => ({ mediaType: 'image/png', data, source })
const glossary = '# Customer Portal\n\n**Device**: a unit in the field.'

const request = (overrides: Partial<PrototypeGrillingInputsRequest> = {}): PrototypeGrillingInputsRequest => ({
  glossary,
  ticked: [],
  extra: [],
  ...overrides,
})

/** The inputs of a request that must be accepted. */
function inputsOf(overrides: Partial<PrototypeGrillingInputsRequest> = {}): PrototypeGrillingInputs {
  const built = buildPrototypeGrillingInputs(request(overrides))
  if (!built.ok) throw new Error(built.reason)
  return built.inputs
}

const textOf = (inputs: { textFiles: { path: string; content: string }[] }, path: string) =>
  inputs.textFiles.find((file) => file.path === path)?.content
const allText = (inputs: PrototypeGrillingInputs) => inputs.textFiles.map((file) => file.content).join('\n')

/** A base64 text that decodes to about `megabytes` MB. */
const bigData = (megabytes: number) => 'A'.repeat(Math.ceil((megabytes * 1024 * 1024 * 4) / 3))

describe('Prototype Grilling inputs: with and without a Draft', () => {
  it('has the Draft as markdown and the Glossary when there is a Draft', () => {
    const inputs = inputsOf({ draft: v1Draft() })
    expect(textOf(inputs, 'draft.md')).toContain('# Archive device from device list')
    expect(textOf(inputs, 'CONTEXT.md')).toBe(glossary)
  })

  it('has no draft.md at all when there is no Draft, and still has the Glossary and images.md', () => {
    const inputs = inputsOf()
    expect(textOf(inputs, 'draft.md')).toBeUndefined()
    expect(textOf(inputs, 'CONTEXT.md')).toBe(glossary)
    expect(textOf(inputs, 'images.md')).toContain('No Images')
  })

  it('leaves Discarded content out and does not name it', () => {
    let draft = v1Draft()
    const scope = sectionByKey(draft, 'scope')
    draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: scope.id, entryId: scope.entries[1].id })
    draft = applyHumanOp(draft, { op: 'discardSection', sectionId: sectionByKey(draft, 'technicalNotes').id })
    const text = allText(inputsOf({ draft }))
    expect(text).not.toContain('Bulk archive')
    expect(text).not.toContain('useDeviceMutation')
    expect(text).not.toContain('Discarded')
  })
})

describe('Prototype Grilling inputs: the Images of the session', () => {
  const ticked = [png('AAAA', 'Grilling Session of 2026-10-01, Image 1')]
  const extra = [{ mediaType: 'image/jpeg' as const, data: 'BBBB' }]

  it('numbers ticked Images first and start-form Images after them, listed in images.md', () => {
    const inputs = inputsOf({ draft: v1Draft(), ticked, extra })
    expect(inputs.images.map(({ number, data }) => [number, data])).toEqual([
      [1, 'AAAA'],
      [2, 'BBBB'],
    ])
    expect(textOf(inputs, 'images.md')).toContain('Image 1 (images/1.png): Grilling Session of 2026-10-01, Image 1')
    expect(textOf(inputs, 'images.md')).toContain('Image 2 (images/2.jpg)')
  })

  it('works from Images alone, with no Draft', () => {
    const inputs = inputsOf({ extra })
    expect(inputs.messageImages).toEqual([{ number: 1, mediaType: 'image/jpeg', data: 'BBBB' }])
  })

  it('writes the starting Prototype as prototype.html with its assumptions as questions to settle', () => {
    const starting = {
      html: '<img src="images/1">',
      assumptions: [{ choice: 'Ten rows per page', why: 'No page size given.' }],
      images: [{ number: 1, source: 'old', mediaType: 'image/png' as const, data: 'KEPT' }],
    }
    const inputs = inputsOf({ starting })
    expect(textOf(inputs, 'prototype.html')).toBe('<img src="images/1">')
    expect(textOf(inputs, 'start-assumptions.md')).toContain('Ten rows per page')
    expect(inputs.images.filter((image) => image.kept).map((image) => image.data)).toEqual(['KEPT'])
  })

  it('accepts Images up to 20 MB and refuses more, with the reason the start form shows', () => {
    const half = SESSION_IMAGE_WARNING_BYTES / 2 / (1024 * 1024)
    const bigTicked = [{ mediaType: 'image/png' as const, data: bigData(half), source: 's' }]
    const bigExtra = (megabytes: number) => [{ mediaType: 'image/png' as const, data: bigData(megabytes) }]
    expect(buildPrototypeGrillingInputs(request({ ticked: bigTicked, extra: bigExtra(half) })).ok).toBe(true)
    const over = buildPrototypeGrillingInputs(request({ ticked: bigTicked, extra: bigExtra(half + 1) }))
    expect(over).toEqual({ ok: false, reason: PROTOTYPE_IMAGES_TOO_LARGE })
  })

  it('does not count Images kept from the starting Prototype towards the limit', () => {
    const starting = {
      html: '<img src="images/1">',
      assumptions: [],
      images: [{ number: 1, source: 'old', mediaType: 'image/png' as const, data: bigData(25) }],
    }
    expect(buildPrototypeGrillingInputs(request({ starting })).ok).toBe(true)
  })
})

describe('Prototype Grilling inputs: a Continuation carries the earlier session’s Images at their numbers', () => {
  it('keeps the numbers the earlier session gave, gaps included', () => {
    const inputs = inputsOf({
      ticked: [png('t1', 'Grilling Session of 2026-10-01, Image 1')],
      carried: [
        { ...png('c5', 'Added in the conversation'), number: 5 },
        { ...png('c2', 'Added on the start form'), number: 2 },
      ],
    })
    expect(inputs.images.map((image) => [image.number, image.data, image.kept])).toEqual([
      [1, 't1', false],
      [2, 'c2', false],
      [5, 'c5', false],
    ])
    expect(textOf(inputs, 'images.md')).toContain('Image 5')
  })

  it('numbers an Image kept from the starting Prototype after the highest carried number', () => {
    const inputs = inputsOf({
      carried: [{ ...png('c4', 'Added in the conversation'), number: 4 }],
      starting: { html: '<img src="images/1">', assumptions: [], images: [{ ...png('k', 'old'), number: 1 }] },
    })
    expect(inputs.images.find((image) => image.kept)?.number).toBe(5)
  })

  it('counts carried Images towards the 20 MB', () => {
    const built = buildPrototypeGrillingInputs(
      request({ carried: [{ ...png(bigData(21), 'Added in the conversation'), number: 3 }] }),
    )
    expect(built).toEqual({ ok: false, reason: PROTOTYPE_IMAGES_TOO_LARGE })
  })
})

describe('Prototype Grilling inputs: the additions of one round', () => {
  const existing: InputImage[] = [
    {
      number: 1,
      mediaType: 'image/png',
      data: 'AAAA',
      source: 'Added on the start form',
      path: 'images/1.png',
      kept: false,
    },
    {
      number: 4,
      mediaType: 'image/png',
      data: 'KEPT',
      source: 'kept from the starting Prototype (x)',
      path: 'images/4.png',
      kept: true,
    },
  ]
  const previous = {
    html: '<img src="images/4"><p>round one</p>',
    assumptions: [{ choice: 'Blue header', why: 'No colour given.' }],
  }
  const round = (overrides: Partial<RoundAdditionsRequest> = {}): RoundAdditionsRequest => ({
    images: existing,
    sent: [],
    previous,
    ...overrides,
  })
  const additionsOf = (overrides: Partial<RoundAdditionsRequest> = {}) => {
    const built = buildRoundAdditions(round(overrides))
    if (!built.ok) throw new Error(built.reason)
    return built.additions
  }

  it('makes the previous round’s Prototype the new starting file, with its assumptions', () => {
    const additions = additionsOf()
    expect(textOf(additions, 'prototype.html')).toBe(previous.html)
    expect(textOf(additions, 'start-assumptions.md')).toContain('Blue header')
  })

  it('numbers new Images after every number the session has used, kept ones included', () => {
    const sent = [
      { mediaType: 'image/jpeg' as const, data: 'NEW1' },
      { mediaType: 'image/png' as const, data: 'NEW2' },
    ]
    const additions = additionsOf({ sent })
    expect(additions.newImages.map(({ number, path }) => [number, path])).toEqual([
      [5, 'images/5.jpg'],
      [6, 'images/6.png'],
    ])
    expect(additions.messageImages.map(({ number, data }) => [number, data])).toEqual([
      [5, 'NEW1'],
      [6, 'NEW2'],
    ])
  })

  it('lists old and new Images together in images.md', () => {
    const additions = additionsOf({ sent: [{ mediaType: 'image/png', data: 'NEW1' }] })
    const listing = textOf(additions, 'images.md')
    expect(listing).toContain('Image 1 (images/1.png)')
    expect(listing).toContain('Image 4 (images/4.png): kept from the starting Prototype')
    expect(listing).toContain('Image 5 (images/5.png): Added in the conversation')
    expect(additions.images.map((image) => image.number)).toEqual([1, 4, 5])
  })

  it('sends nothing as an image block when the human sent no Images', () => {
    const additions = additionsOf()
    expect(additions.newImages).toEqual([])
    expect(additions.messageImages).toEqual([])
  })

  it('refuses a round that takes the session over 20 MB, counting the old Images but not the kept ones', () => {
    const big: InputImage = { ...existing[0], data: bigData(19) }
    const kept: InputImage = { ...existing[1], data: bigData(30) }
    const sending = (megabytes: number) =>
      buildRoundAdditions(round({ images: [big, kept], sent: [{ mediaType: 'image/png', data: bigData(megabytes) }] }))
    expect(sending(0.5).ok).toBe(true)
    expect(sending(2)).toEqual({ ok: false, reason: PROTOTYPE_IMAGES_TOO_LARGE })
  })
})
