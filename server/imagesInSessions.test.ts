// Tests of Images in Grilling Sessions through the real backend with the fake Claude: what reaches the child
// process, the Transcript, the saved files and the GET route, numbering across a Continuation, Template Sessions
// refusing Images, and the Draft deletion cascade. Data in data-test/.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { startBackend } from '../test/server/testBackend.ts'

let backend: Awaited<ReturnType<typeof startBackend>>
const call = (...args: Parameters<typeof backend.call>) => backend.call(...args)

beforeEach(async () => {
  backend = await startBackend()
})
afterEach(() => backend.close())

/** A real 1×1 PNG. */
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const png = { mediaType: 'image/png', data: PNG_BASE64 }
const jpeg = { mediaType: 'image/jpeg', data: 'AAAA' }

const transcripts = async (projectId: string, draftId: string) =>
  (await call('GET', `/api/projects/${projectId}/drafts/${draftId}/sessions`)).body as Transcript[]

const waitForStatus = (projectId: string, draftId: string, status: string) =>
  vi.waitFor(async () => expect((await transcripts(projectId, draftId)).at(-1)?.status).toBe(status), {
    timeout: 8000,
    interval: 50,
  })

/** A Draft whose first session is running and waiting for the human. */
async function grillingDraft() {
  const project = (await call('POST', '/api/projects', { name: 'Customer Portal' })).body as { id: string }
  const created = await call('POST', `/api/projects/${project.id}/drafts`, {
    workItemType: 'PBI',
    templateId: defaultPbiTemplate.id,
    requirement: 'Managers archive devices.',
  })
  const { draft, session } = created.body as { draft: Draft; session: SessionSummary }
  await waitForStatus(project.id, draft.id, 'waiting')
  return { projectId: project.id, draftId: draft.id, sessionId: session.id }
}

type Grilled = Awaited<ReturnType<typeof grillingDraft>>

const sayUrl = (sessionId: string) => `/api/sessions/${sessionId}/messages`
const imageUrl = (grilled: Grilled, sessionId: string, number: number) =>
  `/api/projects/${grilled.projectId}/sessions/${sessionId}/images/${number}`

/** The messages of the latest session. */
async function latestMessages(grilled: Grilled) {
  const all = await transcripts(grilled.projectId, grilled.draftId)
  return all.at(-1)!.messages
}

/** The human's messages of the latest session. */
async function humanMessages(grilled: Grilled) {
  const messages = await latestMessages(grilled)
  return messages.filter((message) => message.role === 'human')
}

/** What the fake Claude said, from the latest session's Transcript. */
async function claudeLines(grilled: Grilled) {
  const lines: string[] = []
  for (const message of await latestMessages(grilled)) {
    if (message.role !== 'claude') continue
    for (const segment of message.segments) if (segment.type === 'text') lines.push(segment.text)
  }
  return lines
}

/** Says something with Images and waits for Claude's reply. */
async function sayWithImages(grilled: Grilled, sessionId: string, images: unknown[], text = 'See this') {
  const said = await call('POST', sayUrl(sessionId), { text, kind: 'message', images })
  expect(said.status).toBe(200)
  await waitForStatus(grilled.projectId, grilled.draftId, 'waiting')
}

describe('saying something with Images', () => {
  it('sends the Images to the child process as content blocks, lists them in the Transcript and keeps the files', async () => {
    const grilled = await grillingDraft()
    await sayWithImages(grilled, grilled.sessionId, [png, jpeg])

    const png1 = `Image 1 (image/png, ${PNG_BASE64.length} base64 characters)`
    const jpeg2 = 'Image 2 (image/jpeg, 4 base64 characters)'
    expect((await claudeLines(grilled)).join('\n')).toContain(`Received image blocks: ${png1}; ${jpeg2}.`)
    expect(await humanMessages(grilled)).toContainEqual(
      expect.objectContaining({
        text: 'See this',
        images: [
          { number: 1, mediaType: 'image/png' },
          { number: 2, mediaType: 'image/jpeg' },
        ],
      }),
    )
    expect((await transcripts(grilled.projectId, grilled.draftId))[0].lastImageNumber).toBe(2)

    const served = await backend.raw(imageUrl(grilled, grilled.sessionId, 1))
    expect(served.status).toBe(200)
    expect(served.contentType).toBe('image/png')
    expect(served.bytes.equals(Buffer.from(PNG_BASE64, 'base64'))).toBe(true)
  })

  it('numbers on across messages, accepts Images without text, and leaves a text-only message as it was', async () => {
    const grilled = await grillingDraft()
    await sayWithImages(grilled, grilled.sessionId, [png])
    await sayWithImages(grilled, grilled.sessionId, [png], '')
    expect(await humanMessages(grilled)).toContainEqual(
      expect.objectContaining({ text: '', images: [{ number: 2, mediaType: 'image/png' }] }),
    )

    await call('POST', sayUrl(grilled.sessionId), { text: 'Just words', kind: 'answer' })
    await waitForStatus(grilled.projectId, grilled.draftId, 'waiting')
    const human = await humanMessages(grilled)
    const justWords = human.find((message) => message.role === 'human' && message.text === 'Just words')
    expect(justWords).not.toHaveProperty('images')
    const received = (await claudeLines(grilled)).filter((line) => line.startsWith('Received image blocks'))
    expect(received).toHaveLength(2)
  })

  it('takes only one of two messages sent at once, so Image numbers are never given twice', async () => {
    const grilled = await grillingDraft()
    const send = () => call('POST', sayUrl(grilled.sessionId), { text: 'x', images: [png, png] })
    const replies = await Promise.all([send(), send()])
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])

    await waitForStatus(grilled.projectId, grilled.draftId, 'waiting')
    const human = await humanMessages(grilled)
    expect(human).toHaveLength(1)
    expect(human[0]).toMatchObject({
      images: [
        { number: 1, mediaType: 'image/png' },
        { number: 2, mediaType: 'image/png' },
      ],
    })
    expect((await transcripts(grilled.projectId, grilled.draftId))[0].lastImageNumber).toBe(2)
  })

  it('still refuses an empty message without Images', async () => {
    const grilled = await grillingDraft()
    expect((await call('POST', sayUrl(grilled.sessionId), { text: ' ', images: [] })).status).toBe(409)
  })

  it('checks the Images again on the server and saves nothing when it refuses', async () => {
    const grilled = await grillingDraft()
    const six = Array.from({ length: 6 }, () => png)
    const tooMany = await call('POST', sayUrl(grilled.sessionId), { text: 'x', images: six })
    expect(tooMany.status).toBe(409)
    expect(tooMany.body.error).toContain('at most 5 Images')

    const svg = await call('POST', sayUrl(grilled.sessionId), {
      text: 'x',
      images: [{ mediaType: 'image/svg+xml', data: 'AAAA' }],
    })
    expect(svg.status).toBe(409)
    expect(svg.body.error).toContain('PNG, JPEG, WebP and GIF')

    const notBase64 = await call('POST', sayUrl(grilled.sessionId), {
      text: 'x',
      images: [{ mediaType: 'image/png', data: 'not base64!' }],
    })
    expect(notBase64.status).toBe(409)
    expect((await call('POST', sayUrl(grilled.sessionId), { text: 'x', images: [{ mediaType: 1 }] })).status).toBe(400)

    expect(await humanMessages(grilled)).toEqual([])
    expect((await backend.raw(imageUrl(grilled, grilled.sessionId, 1))).status).toBe(404)
  })

  it('accepts a body over 5 MB on the say route', async () => {
    // The session is unknown, so the answer is the session error, not "Request too large".
    const big = await call('POST', sayUrl('sess-unknown'), { text: 'x'.repeat(6_000_000) })
    expect(big.status).toBe(409)
    expect(big.body.error).toBe('This session is no longer running.')
  })
})

describe('the first message of a session', () => {
  it('shows the Images in the pushed human message and sends them with the seed', async () => {
    const grilled = await grillingDraft()
    await call('POST', `/api/sessions/${grilled.sessionId}/stop`)
    await waitForStatus(grilled.projectId, grilled.draftId, 'stopped')

    const started = await call('POST', `/api/projects/${grilled.projectId}/drafts/${grilled.draftId}/sessions`, {
      kind: 'first',
      humanNote: 'Here is the Figma frame',
      images: [png],
    })
    expect(started.status).toBe(200)
    await waitForStatus(grilled.projectId, grilled.draftId, 'waiting')

    expect(await humanMessages(grilled)).toContainEqual(
      expect.objectContaining({ text: 'Here is the Figma frame', images: [{ number: 1, mediaType: 'image/png' }] }),
    )
    expect((await claudeLines(grilled)).join('\n')).toContain('Received image blocks: Image 1 (image/png')
    expect((await backend.raw(imageUrl(grilled, started.body.id, 1))).status).toBe(200)
  })

  it('starts only one of two sessions started on a Draft at once', async () => {
    const grilled = await grillingDraft()
    await call('POST', `/api/sessions/${grilled.sessionId}/stop`)
    await waitForStatus(grilled.projectId, grilled.draftId, 'stopped')
    const start = () =>
      call('POST', `/api/projects/${grilled.projectId}/drafts/${grilled.draftId}/sessions`, {
        kind: 'first',
        images: [png],
      })
    const replies = await Promise.all([start(), start()])
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])
    await waitForStatus(grilled.projectId, grilled.draftId, 'waiting')
    expect(await transcripts(grilled.projectId, grilled.draftId)).toHaveLength(2)
  })

  it('refuses bad Images without starting a session', async () => {
    const grilled = await grillingDraft()
    await call('POST', `/api/sessions/${grilled.sessionId}/stop`)
    await waitForStatus(grilled.projectId, grilled.draftId, 'stopped')
    const refused = await call('POST', `/api/projects/${grilled.projectId}/drafts/${grilled.draftId}/sessions`, {
      kind: 'first',
      images: [{ mediaType: 'application/pdf', data: 'AAAA' }],
    })
    expect(refused.status).toBe(409)
    expect(await transcripts(grilled.projectId, grilled.draftId)).toHaveLength(1)
  })
})

describe('a Continuation', () => {
  it('numbers its Images after the session it continues and keeps them in its own folder', async () => {
    const grilled = await grillingDraft()
    await sayWithImages(grilled, grilled.sessionId, [png, png])
    await call('POST', `/api/sessions/${grilled.sessionId}/stop`)
    await waitForStatus(grilled.projectId, grilled.draftId, 'stopped')

    const continued = await call(
      'POST',
      `/api/projects/${grilled.projectId}/drafts/${grilled.draftId}/sessions/${grilled.sessionId}/continue`,
      { humanNote: 'Back' },
    )
    expect(continued.status).toBe(200)
    expect(continued.body.lastImageNumber).toBe(2)
    await waitForStatus(grilled.projectId, grilled.draftId, 'waiting')
    await sayWithImages(grilled, continued.body.id, [jpeg])

    expect(await humanMessages(grilled)).toContainEqual(
      expect.objectContaining({ images: [{ number: 3, mediaType: 'image/jpeg' }] }),
    )
    expect((await claudeLines(grilled)).join('\n')).toContain('Image 3 (image/jpeg')
    expect((await backend.raw(imageUrl(grilled, continued.body.id, 3))).status).toBe(200)
    expect((await backend.raw(imageUrl(grilled, grilled.sessionId, 1))).status).toBe(200)
  })
})

describe('the Image route', () => {
  it('serves an Image only for a Transcript of that Project', async () => {
    const grilled = await grillingDraft()
    await sayWithImages(grilled, grilled.sessionId, [png])
    const other = (await call('POST', '/api/projects', { name: 'Other' })).body as { id: string }

    expect((await backend.raw(`/api/projects/${other.id}/sessions/${grilled.sessionId}/images/1`)).status).toBe(404)
    expect((await backend.raw(imageUrl(grilled, grilled.sessionId, 2))).status).toBe(404)
    expect((await backend.raw(imageUrl(grilled, grilled.sessionId, 0))).status).toBe(404)
    expect((await backend.raw(imageUrl(grilled, 'sess-missing', 1))).status).toBe(404)
    expect((await backend.raw(imageUrl(grilled, '..%2Fx', 1))).status).toBe(404)
  })
})

describe('Template Sessions', () => {
  it('do not take Images', async () => {
    const session = (await call('POST', '/api/template-sessions', { workItemType: 'PBI', purpose: 'Spikes' })).body
    const url = `/api/template-sessions/${session.id}`
    await vi.waitFor(async () => expect((await call('GET', url)).body.status).toBe('waiting'), {
      timeout: 8000,
      interval: 50,
    })
    const refused = await call('POST', sayUrl(session.id), { text: 'look', images: [png] })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toBe('Template Sessions do not take Images.')
    const { messages } = (await call('GET', url)).body as { messages: { role: string }[] }
    expect(messages.filter((message) => message.role === 'human')).toEqual([])
  })
})

describe('deleting and keeping', () => {
  it('deleting a Draft removes its Transcripts and Images, while discarding content keeps them', async () => {
    const grilled = await grillingDraft()
    await sayWithImages(grilled, grilled.sessionId, [png])
    await call('POST', `/api/sessions/${grilled.sessionId}/write`)
    await waitForStatus(grilled.projectId, grilled.draftId, 'finished')

    const base = `/api/projects/${grilled.projectId}/drafts/${grilled.draftId}`
    const draft = (await call('GET', base)).body.draft as Draft
    const discardable = draft.sections.find((section) => !section.locked)!
    expect((await call('POST', `${base}/ops`, { op: 'discardSection', sectionId: discardable.id })).status).toBe(200)
    expect(await transcripts(grilled.projectId, grilled.draftId)).toHaveLength(1)
    expect((await backend.raw(imageUrl(grilled, grilled.sessionId, 1))).status).toBe(200)

    expect((await call('DELETE', base)).body).toEqual({ ok: true })
    expect(await transcripts(grilled.projectId, grilled.draftId)).toEqual([])
    expect((await backend.raw(imageUrl(grilled, grilled.sessionId, 1))).status).toBe(404)
  })
})
