// Tests for Prototype inputs: what the Prototype Session's folder holds and which Images Claude is sent.
import { describe, expect, it } from 'vitest'

import { applyHumanOp } from '#core/draft/humanOps.ts'
import {
  buildPrototypeInputs,
  type PrototypeImage,
  type PrototypeInputsRequest,
  type StartingPrototype,
} from '#core/prototype/prototypeInputs.ts'
import { acOf, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

const png = (data: string, source: string): PrototypeImage => ({ mediaType: 'image/png', data, source })
const jpeg = (data: string, source: string): PrototypeImage => ({ mediaType: 'image/jpeg', data, source })

const request = (overrides: Partial<PrototypeInputsRequest> = {}): PrototypeInputsRequest => ({
  draft: v1Draft(),
  glossary: '# Customer Portal\n\n**Device**: a unit in the field.',
  ticked: [],
  extra: [],
  ...overrides,
})

const textOf = (inputs: ReturnType<typeof buildPrototypeInputs>, path: string) =>
  inputs.textFiles.find((file) => file.path === path)?.content
const allText = (inputs: ReturnType<typeof buildPrototypeInputs>) =>
  inputs.textFiles.map((file) => file.content).join('\n')

describe('Prototype inputs: the Draft and the Glossary', () => {
  it('writes the Draft as markdown and the Glossary as given', () => {
    const inputs = buildPrototypeInputs(request())
    expect(textOf(inputs, 'draft.md')).toContain('# Archive device from device list')
    expect(textOf(inputs, 'draft.md')).toContain('AC01 - Archive single device')
    expect(textOf(inputs, 'CONTEXT.md')).toBe('# Customer Portal\n\n**Device**: a unit in the field.')
  })

  it('leaves out Discarded Sections and Entries, and does not even name them', () => {
    let draft = v1Draft()
    const scope = sectionByKey(draft, 'scope')
    draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: scope.id, entryId: scope.entries[1].id })
    draft = applyHumanOp(draft, { op: 'discardSection', sectionId: sectionByKey(draft, 'technicalNotes').id })
    const text = allText(buildPrototypeInputs(request({ draft })))
    expect(text).not.toContain('Bulk archive')
    expect(text).not.toContain('Out of scope')
    expect(text).not.toContain('useDeviceMutation')
    expect(text).not.toContain('Discarded')
    expect(text).toContain('Archive a single device from the device detail page')
  })

  it('ignores a pending Proposal', () => {
    const draft = {
      ...v1Draft(),
      proposal: {
        id: 'prop-1',
        sessionId: 'sess-1',
        kind: 'iteration' as const,
        createdAt: '2026-10-01',
        changes: [
          {
            id: 'chg-1',
            kind: 'retitle' as const,
            label: 'Retitle',
            title: 'PROPOSED TITLE',
            after: 'PROPOSED TITLE',
            conflict: false,
            status: 'pending' as const,
          },
        ],
      },
    }
    expect(allText(buildPrototypeInputs(request({ draft })))).not.toContain('PROPOSED TITLE')
  })

  it('shows the Draft as it stands, including human edits', () => {
    let draft = v1Draft()
    const { id: sectionId, entries } = acOf(draft)
    const body = 'Given X\nWhen Y\nThen Z-EDITED'
    draft = applyHumanOp(draft, { op: 'editEntry', sectionId, entryId: entries[0].id, body })
    expect(textOf(buildPrototypeInputs(request({ draft })), 'draft.md')).toContain('Then Z-EDITED')
  })
})

describe('Prototype inputs: numbering the Images', () => {
  const ticked = [
    png('AAAA', 'Grilling Session of 2026-10-01, Image 1'),
    jpeg('BBBB', 'Grilling Session of 2026-10-03, Image 1'),
  ]
  const extra = [{ mediaType: 'image/png' as const, data: 'CCCC' }]

  it('numbers ticked Images in the order given, then start-form Images last', () => {
    const inputs = buildPrototypeInputs(request({ ticked, extra }))
    expect(inputs.images.map(({ number, data }) => [number, data])).toEqual([
      [1, 'AAAA'],
      [2, 'BBBB'],
      [3, 'CCCC'],
    ])
  })

  it('names each number and its source in images.md', () => {
    const inputs = buildPrototypeInputs(request({ ticked, extra }))
    const listing = textOf(inputs, 'images.md')
    expect(listing).toContain('Image 1 (images/1.png): Grilling Session of 2026-10-01, Image 1')
    expect(listing).toContain('Image 2 (images/2.jpg): Grilling Session of 2026-10-03, Image 1')
    expect(listing).toContain('Image 3 (images/3.png): Added on the start form')
  })

  it('has the Images as files in an images/ folder, with the extension of their type', () => {
    const inputs = buildPrototypeInputs(request({ ticked, extra }))
    expect(inputs.images.map((image) => image.path)).toEqual(['images/1.png', 'images/2.jpg', 'images/3.png'])
  })

  it('leaves out Images that were not ticked', () => {
    const inputs = buildPrototypeInputs(request({ ticked: [ticked[1]] }))
    expect(inputs.images.map((image) => image.data)).toEqual(['BBBB'])
    expect(allText(inputs)).not.toContain('2026-10-01')
  })

  it('says so in images.md when there are no Images, and sends none', () => {
    const inputs = buildPrototypeInputs(request())
    expect(inputs.images).toEqual([])
    expect(inputs.messageImages).toEqual([])
    expect(textOf(inputs, 'images.md')).toContain('No Images')
  })

  it('sends the ticked and extra Images to Claude as numbered image blocks', () => {
    const inputs = buildPrototypeInputs(request({ ticked, extra }))
    expect(inputs.messageImages).toEqual([
      { number: 1, mediaType: 'image/png', data: 'AAAA' },
      { number: 2, mediaType: 'image/jpeg', data: 'BBBB' },
      { number: 3, mediaType: 'image/png', data: 'CCCC' },
    ])
  })
})

describe('Prototype inputs: starting from an earlier Prototype', () => {
  const startingHtml =
    '<body><img src="images/1"><img src="images/2"><div style="background: url(images/2)"></div></body>'
  const starting = (overrides: Partial<StartingPrototype> = {}): StartingPrototype => ({
    html: startingHtml,
    assumptions: [{ choice: 'Table has ten rows', why: 'The Draft gives no page size.' }],
    images: [
      { number: 1, source: 'Grilling Session of 2026-10-01, Image 1', mediaType: 'image/png', data: 'AAAA' },
      { number: 2, source: 'Added on the start form', mediaType: 'image/png', data: 'KEPT' },
    ],
    ...overrides,
  })

  it('has no prototype.html and no starting assumptions when there is no starting Prototype', () => {
    const inputs = buildPrototypeInputs(request())
    expect(textOf(inputs, 'prototype.html')).toBeUndefined()
    expect(textOf(inputs, 'start-assumptions.md')).toBeUndefined()
  })

  it('writes the starting source as the initial prototype.html and its assumptions as start-assumptions.md', () => {
    const inputs = buildPrototypeInputs(request({ ticked: [png('AAAA', 's')], starting: starting() }))
    expect(textOf(inputs, 'prototype.html')).toBeDefined()
    const assumptions = textOf(inputs, 'start-assumptions.md')
    expect(assumptions).toContain('Table has ten rows')
    expect(assumptions).toContain('The Draft gives no page size.')
  })

  it('renumbers the starting references to this session numbering', () => {
    // The starting Image 1 is now Image 2 here; its Image 2 ("KEPT") is not in this session and is added as Image 3.
    const ticked = [
      png('NEW0', 'Grilling Session of 2026-10-05, Image 1'),
      png('AAAA', 'Grilling Session of 2026-10-01, Image 1'),
    ]
    const html = textOf(buildPrototypeInputs(request({ ticked, starting: starting() })), 'prototype.html')
    expect(html).toBe(
      '<body><img src="images/2"><img src="images/3"><div style="background: url(images/3)"></div></body>',
    )
  })

  it('does not chain renumbering when a number is swapped with another', () => {
    const ticked = [png('BBBB', 's2'), png('AAAA', 's1')]
    const swapped = starting({
      html: '<img src="images/1"><img src="images/2">',
      images: [
        { number: 1, source: 's1', mediaType: 'image/png', data: 'AAAA' },
        { number: 2, source: 's2', mediaType: 'image/png', data: 'BBBB' },
      ],
    })
    expect(textOf(buildPrototypeInputs(request({ ticked, starting: swapped })), 'prototype.html')).toBe(
      '<img src="images/2"><img src="images/1">',
    )
  })

  it('adds Images the starting Prototype used but this session lacks as files marked as kept', () => {
    const inputs = buildPrototypeInputs(request({ ticked: [png('AAAA', 's')], starting: starting() }))
    const kept = inputs.images.filter((image) => image.kept)
    expect(kept).toEqual([expect.objectContaining({ number: 2, data: 'KEPT', path: 'images/2.png' })])
    expect(textOf(inputs, 'images.md')).toContain('Image 2 (images/2.png): kept from the starting Prototype')
  })

  it('does not send kept Images to Claude as image blocks, and an Image already ticked is not kept twice', () => {
    const inputs = buildPrototypeInputs(request({ ticked: [png('AAAA', 's')], starting: starting() }))
    expect(inputs.messageImages.map((image) => image.data)).toEqual(['AAAA'])
    expect(inputs.images.map((image) => image.data)).toEqual(['AAAA', 'KEPT'])
  })

  it('recognises a start-form Image the starting Prototype also used, so it is not kept twice', () => {
    const inputs = buildPrototypeInputs(
      request({ extra: [{ mediaType: 'image/png', data: 'KEPT' }], starting: starting() }),
    )
    expect(inputs.images.filter((image) => image.data === 'KEPT')).toHaveLength(1)
    // Only the starting Prototype's other Image (AAAA) is kept.
    expect(inputs.images.filter((image) => image.kept).map((image) => image.data)).toEqual(['AAAA'])
  })

  it('numbers kept Images after the ticked and extra ones', () => {
    const inputs = buildPrototypeInputs(
      request({
        ticked: [png('T1', 'a'), png('T2', 'b')],
        extra: [{ mediaType: 'image/png', data: 'E1' }],
        starting: starting(),
      }),
    )
    expect(inputs.images.map(({ number, data }) => [number, data])).toEqual([
      [1, 'T1'],
      [2, 'T2'],
      [3, 'E1'],
      [4, 'AAAA'],
      [5, 'KEPT'],
    ])
  })
})
