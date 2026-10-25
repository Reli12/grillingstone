// HTTP tests of the Prototype routes through the real backend with the fake Claude: every refusal of a start, the
// lists by Draft and by Project, the inputs for 'Try again', and the view route with its headers. Data in data-test/.
import fs from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PROTOTYPE_VIEW_CSP } from '#core/prototype/prototypeAssembly.ts'
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { prototypeKit } from '../test/server/prototypeKit.ts'
import { startBackend, type TestBackend } from '../test/server/testBackend.ts'
import { prototypeFile } from './storage/paths.ts'

let backend: TestBackend
let kit: ReturnType<typeof prototypeKit>
const call = (...args: Parameters<TestBackend['call']>) => backend.call(...args)

beforeEach(async () => {
  backend = await startBackend()
  kit = prototypeKit(backend)
})
afterEach(() => backend.close())

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const png = { mediaType: 'image/png', data: PNG_BASE64 }
const MEGABYTE = 1024 * 1024

/** A well-formed Image of about `megabytes` MB (decoded) — the Image rules look at type, size and base64 only. */
const bigImage = (megabytes: number) => ({
  mediaType: 'image/png',
  data: Buffer.alloc(Math.floor(megabytes * MEGABYTE), 7).toString('base64'),
})

const projectUrl = (projectId: string) => `/api/projects/${projectId}`

describe('starting a Prototype Session', () => {
  it('is refused below v1, and starts nothing', async () => {
    const grilled = await kit.grillingDraft()
    const refused = await kit.startPrototype(grilled)
    expect(refused.status).toBe(409)
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('is refused with more than 5 extra Images', async () => {
    const grilled = await kit.draftAtV1()
    const refused = await kit.startPrototype(grilled, { extraImages: Array.from({ length: 6 }, () => png) })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toContain('at most 5 Images')
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('is refused for an extra Image that breaks the Image rules', async () => {
    const grilled = await kit.draftAtV1()
    const refused = await kit.startPrototype(grilled, { extraImages: [{ mediaType: 'image/svg+xml', data: 'AAAA' }] })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toContain('PNG, JPEG, WebP and GIF')
    expect((await kit.startPrototype(grilled, { extraImages: [{ mediaType: 1 }] })).status).toBe(400)
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('is refused over 20 MB of Images in total', async () => {
    const grilled = await kit.draftAtV1()
    const refused = await kit.startPrototype(grilled, { extraImages: Array.from({ length: 5 }, () => bigImage(4.2)) })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toContain('20 MB')
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('counts the ticked Images in the 20 MB too', async () => {
    const grilled = await kit.grillingDraft([bigImage(4.9)])
    await call('POST', `/api/sessions/${grilled.sessionId}/write`)
    await kit.waitForGrilling(grilled, 'finished')
    const refused = await kit.startPrototype(grilled, {
      tickedImages: [{ sessionId: grilled.sessionId, number: 1 }],
      extraImages: Array.from({ length: 4 }, () => bigImage(4.9)),
    })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toContain('20 MB')
  })

  it('is refused for a ticked Image the Draft’s Grilling Sessions do not have', async () => {
    const grilled = await kit.draftAtV1()
    const refused = await kit.startPrototype(grilled, { tickedImages: [{ sessionId: grilled.sessionId, number: 1 }] })
    expect(refused.status).toBe(409)
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('is refused with a starting Prototype of another Draft', async () => {
    const grilled = await kit.draftAtV1()
    const other = await kit.draftAtV1([], grilled.projectId)
    await kit.runPrototype(other, 'finished')
    const foreign = await kit.newestPrototype(other)

    const refused = await kit.startPrototype(grilled, { startingPrototypeId: foreign.id })
    expect(refused.status).toBe(409)
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('is refused while a Prototype is being written on the Draft', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    expect((await kit.startPrototype(grilled)).status).toBe(200)
    expect((await kit.startPrototype(grilled)).status).toBe(409)
  })

  it('takes a body over 5 MB, which other routes refuse', async () => {
    const grilled = await kit.draftAtV1()
    const images = [bigImage(3.6), bigImage(3.6)]
    // runPrototype expects a 200 and waits for the session to end, so no write is left pending when the test ends.
    await kit.runPrototype(grilled, 'finished', { extraImages: images })
  })

  it('is refused for a Draft or Project that does not exist', async () => {
    const grilled = await kit.draftAtV1()
    const missingDraft = await call('POST', `${projectUrl(grilled.projectId)}/drafts/d-missing/prototype-sessions`, {})
    expect(missingDraft.status).toBe(404)
    expect((await call('POST', `${projectUrl('missing')}/drafts/d-missing/prototype-sessions`, {})).status).toBe(404)
  })
})

describe('listing', () => {
  it('lists a Draft’s rows and the Project’s rows, newest first', async () => {
    const grilled = await kit.draftAtV1()
    await kit.runPrototype(grilled, 'finished')
    await kit.steer(grilled, 'fake:no-submit')
    await kit.runPrototype(grilled, 'failed')

    expect(await kit.kindsOf(grilled)).toEqual(['failed', 'finished'])
    const project = (await call('GET', `${projectUrl(grilled.projectId)}/prototypes`)).body
    expect(project.map((row: { kind: string }) => row.kind)).toEqual(['failed', 'finished'])
    expect((await call('GET', `${projectUrl('missing')}/prototypes`)).status).toBe(404)
  })

  it('has no rows for a Draft without Prototypes', async () => {
    const grilled = await kit.draftAtV1()
    expect(await kit.rowsOf(grilled)).toEqual([])
  })

  it('keeps one Project’s rows out of another’s', async () => {
    const grilled = await kit.draftAtV1()
    await kit.runPrototype(grilled, 'finished')
    const other = await kit.draftAtV1()
    expect((await call('GET', `${projectUrl(other.projectId)}/prototypes`)).body).toEqual([])
  })
})

describe('the inputs of a session', () => {
  it('are found for a session of the Project only', async () => {
    const grilled = await kit.draftAtV1()
    const started = await kit.runPrototype(grilled, 'finished')
    const other = await kit.draftAtV1()
    const inputsUrl = (projectId: string, sessionId: string) =>
      `${projectUrl(projectId)}/prototype-sessions/${sessionId}/inputs`
    expect((await call('GET', inputsUrl(grilled.projectId, started.id))).status).toBe(200)
    expect((await call('GET', inputsUrl(other.projectId, started.id))).status).toBe(404)
    expect((await call('GET', inputsUrl(grilled.projectId, '..%2Fx'))).status).toBe(404)
  })

  it('name the starting Prototype', async () => {
    const grilled = await kit.draftAtV1()
    await kit.runPrototype(grilled, 'finished')
    const earlier = await kit.newestPrototype(grilled)
    const response = await kit.startPrototype(grilled, { startingPrototypeId: earlier.id })
    const started = response.body as PrototypeSessionSummary
    await kit.waitForRows(grilled, ['finished', 'finished'])
    const inputs = await call('GET', `${projectUrl(grilled.projectId)}/prototype-sessions/${started.id}/inputs`)
    expect(inputs.body).toEqual({ tickedImages: [], extraImages: [], startingPrototypeId: earlier.id })
  })
})

describe('the view route', () => {
  async function finished() {
    const grilled = await kit.draftAtV1()
    await kit.runPrototype(grilled, 'finished')
    const prototype = await kit.newestPrototype(grilled)
    const url = `${projectUrl(grilled.projectId)}/prototypes/${prototype.id}/view`
    return { grilled, prototype, url }
  }

  it('serves the stored page sandboxed, unsniffed, without referrer and uncached', async () => {
    const { url, prototype, grilled } = await finished()
    const served = await backend.raw(url)

    expect(served.status).toBe(200)
    expect(served.contentType).toBe('text/html; charset=utf-8')
    expect(served.headers.get('content-security-policy')).toBe(
      "sandbox allow-scripts allow-forms allow-modals; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'",
    )
    expect(served.headers.get('content-security-policy')).toBe(PROTOTYPE_VIEW_CSP)
    expect(served.headers.get('x-content-type-options')).toBe('nosniff')
    expect(served.headers.get('referrer-policy')).toBe('no-referrer')
    expect(served.headers.get('cache-control')).toBe('no-store')
    expect(served.headers.get('content-disposition')).toBeNull()
    expect(served.bytes.toString('utf8')).toBe(
      await fs.readFile(prototypeFile(grilled.projectId, prototype.id, 'html'), 'utf8'),
    )
  })

  it('serves a download as an attachment named after the Draft, version and time', async () => {
    const { url, prototype, grilled } = await finished()
    const draft = await kit.getDraft(grilled)
    const served = await backend.raw(`${url}?download=1`)

    expect(served.status).toBe(200)
    const disposition = served.headers.get('content-disposition') ?? ''
    expect(disposition.startsWith('attachment;')).toBe(true)
    const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1] ?? ''
    const name = decodeURIComponent(encoded)
    expect(name.startsWith(`${draft.title} – v1 – `)).toBe(true)
    expect(name).toMatch(/ – v1 – \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.html$/)
    // The plain fallback is ASCII, so any client reads the header.
    expect(/filename="([\x20-\x7e]+)"/.test(disposition)).toBe(true)
    // The same page, sandbox headers included, so a download opened by URL stays contained.
    expect(served.headers.get('content-security-policy')).toBe(PROTOTYPE_VIEW_CSP)
    expect(served.bytes.toString('utf8')).toBe(
      await fs.readFile(prototypeFile(grilled.projectId, prototype.id, 'html'), 'utf8'),
    )
  })

  it('serves no attachment for any other download value', async () => {
    const { url } = await finished()
    expect((await backend.raw(`${url}?download=0`)).headers.get('content-disposition')).toBeNull()
  })

  it('refuses requests with Origin: null and with other origins', async () => {
    const { url } = await finished()
    expect((await backend.raw(url, { origin: 'null' })).status).toBe(403)
    expect((await backend.raw(url, { origin: 'https://evil.example' })).status).toBe(403)
  })

  it('does not find a Prototype of another Project, a missing one or an unsafe id', async () => {
    const { prototype } = await finished()
    const other = await kit.draftAtV1()
    expect((await backend.raw(`${projectUrl(other.projectId)}/prototypes/${prototype.id}/view`)).status).toBe(404)
    expect((await backend.raw(`${projectUrl(other.projectId)}/prototypes/proto-nope/view`)).status).toBe(404)
    expect((await backend.raw(`${projectUrl(other.projectId)}/prototypes/..%2Fx/view`)).status).toBe(404)
  })

  it('has a record route for the viewer bar, with the Draft’s title', async () => {
    const { grilled, prototype } = await finished()
    const found = await call('GET', `${projectUrl(grilled.projectId)}/prototypes/${prototype.id}`)
    expect(found.status).toBe(200)
    const draft = await kit.getDraft(grilled)
    expect(found.body).toMatchObject({ prototype: { id: prototype.id }, draftTitle: draft.title })
  })
})
