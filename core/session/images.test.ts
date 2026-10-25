// Tests for the Image rules: accepted types, each limit with its reason, numbering, and the content Claude receives.
import { describe, expect, it } from 'vitest'

import {
  base64ByteLength,
  buildMessageContent,
  checkImageType,
  checkMessageImages,
  IMAGE_MEDIA_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  numberImages,
  parseMessageImages,
  shrinkToFit,
} from '#core/session/images.ts'

/** Base64 of `bytes` zero bytes. */
const base64Of = (bytes: number) => Buffer.alloc(bytes).toString('base64')
const png = (data = 'AAAA') => ({ mediaType: 'image/png', data })

describe('Image types', () => {
  it('accepts PNG, JPEG, WebP and GIF', () => {
    expect(IMAGE_MEDIA_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    for (const mediaType of IMAGE_MEDIA_TYPES) expect(checkImageType(mediaType)).toBeNull()
  })

  it('refuses HEIC, SVG and PDF with a reason a human can act on', () => {
    for (const mediaType of ['image/heic', 'image/svg+xml', 'application/pdf', '']) {
      expect(checkImageType(mediaType)).toMatchObject({
        code: 'image-type',
        message: 'Only PNG, JPEG, WebP and GIF Images can be added.',
      })
    }
  })
})

describe('checking the Images of one message', () => {
  it('accepts up to five Images', () => {
    const five = Array.from({ length: MAX_IMAGES_PER_MESSAGE }, () => png())
    expect(checkMessageImages(five)).toEqual([])
    expect(checkMessageImages([])).toEqual([])
  })

  it('refuses a sixth Image', () => {
    const six = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 1 }, () => png())
    const reason = { code: 'image-count', message: 'A message can have at most 5 Images.' }
    expect(checkMessageImages(six)).toEqual([reason])
  })

  it('refuses an Image of another type', () => {
    expect(checkMessageImages([png(), { mediaType: 'image/heic', data: 'AAAA' }])).toEqual([
      { code: 'image-type', message: 'Only PNG, JPEG, WebP and GIF Images can be added.' },
    ])
  })

  it('refuses an Image over 5 MB, measured on the decoded bytes, and accepts one exactly at the limit', () => {
    const atLimit = base64Of(MAX_IMAGE_BYTES)
    expect(base64ByteLength(atLimit)).toBe(MAX_IMAGE_BYTES)
    expect(checkMessageImages([png(atLimit)])).toEqual([])
    const over = base64Of(MAX_IMAGE_BYTES + 3)
    expect(checkMessageImages([png(over)])).toEqual([
      { code: 'image-size', message: 'An Image can be at most 5 MB after shrinking.' },
    ])
  })

  it('refuses data that is not base64', () => {
    expect(checkMessageImages([png('not base64!')])).toEqual([
      { code: 'image-data', message: 'The Image data is not valid base64.' },
    ])
  })

  it('refuses a very long run of "=" quickly, as too big or not base64', () => {
    const started = performance.now()
    const huge = checkMessageImages([png(`AAAA${'='.repeat(20_000_000)}`)])
    expect(huge).toEqual([{ code: 'image-size', message: 'An Image can be at most 5 MB after shrinking.' }])
    const padded = checkMessageImages([png('='.repeat(1_000_000))])
    expect(padded).toEqual([{ code: 'image-data', message: 'The Image data is not valid base64.' }])
    expect(checkMessageImages([png('AAA===')])).toEqual(padded)
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('hands back the Images with their types narrowed, or the reasons', () => {
    expect(parseMessageImages([png()])).toEqual({ ok: true, images: [{ mediaType: 'image/png', data: 'AAAA' }] })
    expect(parseMessageImages([{ mediaType: 'image/heic', data: 'AAAA' }])).toMatchObject({
      ok: false,
      reasons: [{ code: 'image-type' }],
    })
  })

  it('counts the padding of base64 when measuring', () => {
    expect(base64ByteLength(Buffer.from('ab').toString('base64'))).toBe(2)
    expect(base64ByteLength(Buffer.from('a').toString('base64'))).toBe(1)
  })
})

describe('shrinking', () => {
  it('brings the long edge down to 2000 px and keeps the proportions', () => {
    expect(shrinkToFit({ width: 4000, height: 3000 })).toEqual({ width: 2000, height: 1500 })
    expect(shrinkToFit({ width: 1000, height: 5000 })).toEqual({ width: 400, height: 2000 })
  })

  it('leaves an Image that is small enough alone, and never makes a side 0', () => {
    expect(shrinkToFit({ width: 2000, height: 10 })).toEqual({ width: 2000, height: 10 })
    expect(shrinkToFit({ width: 100_000, height: 1 })).toEqual({ width: 2000, height: 1 })
  })
})

describe('numbering', () => {
  it('numbers Images 1…n across a Transcript, not per message', () => {
    const first = numberImages([png(), png()], undefined)
    expect(first.map((image) => image.number)).toEqual([1, 2])
    const second = numberImages([png()], 2)
    expect(second.map((image) => image.number)).toEqual([3])
  })

  it('keeps the type of what it numbers', () => {
    const [image] = numberImages([{ mediaType: 'image/png' as const, data: 'AAAA' }], 4)
    expect(image).toEqual({ mediaType: 'image/png', data: 'AAAA', number: 5 })
  })
})

describe('the content Claude receives', () => {
  const numbered = numberImages([png('AAAA'), { mediaType: 'image/jpeg', data: 'BBBB' }], 2)

  it('puts each Image after its "Image n:" label and before the text', () => {
    expect(buildMessageContent('What is wrong here?', numbered)).toEqual([
      { type: 'text', text: 'Image 3:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'text', text: 'Image 4:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BBBB' } },
      { type: 'text', text: 'What is wrong here?' },
    ])
  })

  it('sends Images only when there is no text', () => {
    const content = buildMessageContent('', numbered)
    expect(content).toHaveLength(4)
    expect(content.at(-1)).toMatchObject({ type: 'image' })
  })

  it('leaves a text-only message as the plain text', () => {
    expect(buildMessageContent('Just words', [])).toBe('Just words')
  })
})
