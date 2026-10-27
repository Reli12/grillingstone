// Tests for the Prototype submit contract: the payload schema, reading prototype.html from the session folder,
// assembly's refusals, and what is stored on acceptance. Session folders are made in data-test/.
import fs from 'node:fs/promises'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { resetTestData } from '../../test/server/testBackend.ts'
import { DATA_DIR } from '../config.ts'
import { prototypeSubmitter, type StoredPrototype } from './prototypeSubmitter.ts'

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const assumptions = [{ choice: 'Ten rows per page', why: 'The Draft gives no page size.' }]
const payload = { prototype: 'prototype.html', assumptions }
const goodHtml = '<!doctype html><html><head></head><body><button>Archive</button><img src="images/1"></body></html>'

let sessionDir: string
beforeEach(async () => {
  await resetTestData()
  sessionDir = path.join(DATA_DIR, 'prototype-work', 'sess-1')
  await fs.mkdir(sessionDir, { recursive: true })
})

const writeSource = (html: string) => fs.writeFile(path.join(sessionDir, 'prototype.html'), html)

function submitter() {
  const stored: StoredPrototype[] = []
  const submit = prototypeSubmitter({
    sessionDir,
    images: [{ number: 1, mediaType: 'image/png', data: PIXEL }],
    store: (prototype) => {
      stored.push(prototype)
      return Promise.resolve()
    },
  })
  return { submit, stored }
}

const reasonCodes = async (submit: ReturnType<typeof submitter>['submit'], body: unknown) => {
  const result = await submit(body)
  return result.ok ? [] : result.reasons.map((reason) => reason.code)
}

describe('Prototype submit contract', () => {
  it('reads prototype.html from the session folder, assembles it and stores source and result', async () => {
    await writeSource(goodHtml)
    const { submit, stored } = submitter()

    const result = await submit(payload)

    expect(result).toEqual({ ok: true, message: expect.stringContaining('Prototype saved') })
    expect(stored).toHaveLength(1)
    expect(stored[0].source).toBe(goodHtml)
    expect(stored[0].assumptions).toEqual(assumptions)
    expect(stored[0].usedImages).toEqual([1])
    expect(stored[0].html).toContain(`data:image/png;base64,${PIXEL}`)
    expect(stored[0].html).toContain('Assumptions (1)')
  })

  it('refuses with assembly reasons and stores nothing, then accepts the fixed file on the next submit', async () => {
    await writeSource('<body><img src="https://cdn.example.com/a.png"></body>')
    const { submit, stored } = submitter()

    const refused = await submit(payload)
    expect(refused).toMatchObject({ ok: false, reasons: [{ code: 'external-reference' }] })
    expect(stored).toEqual([])

    await writeSource(goodHtml)
    expect((await submit(payload)).ok).toBe(true)
    expect(stored).toHaveLength(1)
  })

  it('reads the file again on every submit, so the Edit between two submits is what counts', async () => {
    const { submit, stored } = submitter()
    await writeSource('<base href="#">')
    expect((await submit(payload)).ok).toBe(false)
    await writeSource(goodHtml)
    expect((await submit(payload)).ok).toBe(true)
    expect(stored[0].source).toBe(goodHtml)
  })

  it('refuses an empty assumptions list through assembly', async () => {
    await writeSource(goodHtml)
    expect(await reasonCodes(submitter().submit, { ...payload, assumptions: [] })).toEqual(['no-assumptions'])
  })

  it('refuses a missing prototype.html, naming the file', async () => {
    const result = await submitter().submit(payload)
    expect(result).toMatchObject({ ok: false, reasons: [{ code: 'missing-prototype' }] })
    if (!result.ok) expect(result.reasons[0].message).toContain('prototype.html')
  })

  it('refuses an empty prototype.html', async () => {
    await writeSource('  \n')
    expect(await reasonCodes(submitter().submit, payload)).toEqual(['missing-prototype'])
  })

  it.each([
    ['not an object', 'prototype.html'],
    ['no assumptions field', { prototype: 'prototype.html' }],
    ['a file name other than prototype.html', { prototype: '../secret.html', assumptions }],
    ['assumptions that are not a list', { prototype: 'prototype.html', assumptions: 'many' }],
    ['an assumption without a why', { prototype: 'prototype.html', assumptions: [{ choice: 'x' }] }],
    ['an assumption with a non-string choice', { prototype: 'prototype.html', assumptions: [{ choice: 1, why: 'x' }] }],
  ])('refuses a payload with %s, without reading any file', async (_name, body) => {
    await writeSource(goodHtml)
    const { submit, stored } = submitter()
    const result = await submit(body)
    expect(result).toMatchObject({ ok: false, reasons: [{ code: 'invalid-payload' }] })
    expect(stored).toEqual([])
  })

  it('names the offending field in a payload reason', async () => {
    const result = await submitter().submit({ prototype: 'prototype.html', assumptions: [{ choice: 'x' }] })
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reasons[0].message).toContain('assumptions')
  })
})
