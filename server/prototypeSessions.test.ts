// Tests of Prototype Sessions through the real backend with the fake Claude: the per-kind lock beside a Grilling
// Session, what ends a session as finished, Failed or Stopped, what reaches Claude, what a run leaves alone, the
// restart handling and the live events. Data in data-test/.
import fs from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { draftUrl, prototypeKit, stopUrl } from '../test/server/prototypeKit.ts'
import { startBackend, type TestBackend } from '../test/server/testBackend.ts'
import { glossaryFile, prototypeWorkDir } from './storage/paths.ts'
import {
  getPrototype,
  getPrototypeSession,
  listPrototypeSessions,
  readPrototypeHtml,
  readPrototypeSource,
  savePrototypeSession,
} from './storage/prototypes.ts'

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
const jpeg = { mediaType: 'image/jpeg', data: 'AAAA' }

/** What the fake Claude said in a session, from the record on disk. */
async function claudeSaid(projectId: string, sessionId: string) {
  const session = await getPrototypeSession(projectId, sessionId)
  return session.messages.flatMap((message) =>
    message.role === 'claude' ? message.segments.flatMap((s) => (s.type === 'text' ? [s.text] : [])) : [],
  )
}

describe('a Prototype Session that succeeds', () => {
  it('ends finished with one Prototype labelled with the Draft version, and removes its working folder', async () => {
    const grilled = await kit.draftAtV1()
    const started = await kit.runPrototype(grilled, 'finished')

    expect(started).toMatchObject({ kind: 'prototype', draftId: grilled.draftId, draftVersion: 1 })
    const prototype = await kit.newestPrototype(grilled)
    expect(prototype).toMatchObject({ draftId: grilled.draftId, draftVersion: 1 })
    expect(prototype.assumptions).toHaveLength(1)
    expect(await readPrototypeHtml(grilled.projectId, prototype.id)).toContain('Assumptions (1)')
    expect(await readPrototypeSource(grilled.projectId, prototype.id)).not.toContain('Assumptions (1)')
    expect(await getPrototypeSession(grilled.projectId, started.id)).toMatchObject({
      status: 'finished',
      prototypeId: prototype.id,
    })
    await expect(fs.stat(prototypeWorkDir(started.id))).rejects.toThrow()
  })

  it('takes a refused submit and a fixed resubmit as finished, the Edit having removed what was refused', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:refuse-first')
    const started = await kit.runPrototype(grilled, 'finished')

    const prototype = await kit.newestPrototype(grilled)
    expect(await readPrototypeSource(grilled.projectId, prototype.id)).not.toContain('https://')
    const record = await getPrototypeSession(grilled.projectId, started.id)
    const system = record.messages.flatMap((message) => (message.role === 'system' ? [message.text] : []))
    expect(system.some((text) => text.startsWith('Submission refused'))).toBe(true)
    const tools = record.messages.flatMap((message) => (message.role === 'tool' ? [message.tool] : []))
    expect(tools).toEqual(['Read', 'Write', 'Bash', 'Edit', 'Bash'])
  })

  it('sends the ticked Images of the Draft’s Grilling Sessions and the extra Images as image blocks', async () => {
    const grilled = await kit.draftAtV1([png])
    const started = await kit.runPrototype(grilled, 'finished', {
      tickedImages: [{ sessionId: grilled.sessionId, number: 1 }],
      extraImages: [jpeg],
    })

    const said = (await claudeSaid(grilled.projectId, started.id)).join('\n')
    const pngBlock = `Image 1 (image/png, ${PNG_BASE64.length} base64 characters)`
    expect(said).toContain(`Received image blocks: ${pngBlock}; Image 2 (image/jpeg, 4 base64 characters).`)
    const prototype = await kit.newestPrototype(grilled)
    expect(await readPrototypeHtml(grilled.projectId, prototype.id)).toContain(`data:image/png;base64,${PNG_BASE64}`)
    expect(prototype.images).toEqual([
      { number: 1, mediaType: 'image/png', source: expect.stringContaining('Grilling Session') },
    ])
    // The inputs are kept for 'Try again', extra Images included.
    const inputs = await call('GET', `/api/projects/${grilled.projectId}/prototype-sessions/${started.id}/inputs`)
    expect(inputs.body).toEqual({
      tickedImages: [{ sessionId: grilled.sessionId, number: 1 }],
      extraImages: [jpeg],
    })
  })

  it('leaves the Draft, the Proposals and the Glossary as they were', async () => {
    const grilled = await kit.draftAtV1()
    await fs.writeFile(glossaryFile(grilled.projectId), '# Glossary\n\n**Device**: a thing.\n')
    const glossaryBefore = await fs.readFile(glossaryFile(grilled.projectId))
    const draftBefore = await kit.getDraft(grilled)

    await kit.runPrototype(grilled, 'finished')

    expect(await kit.getDraft(grilled)).toEqual(draftBefore)
    expect(draftBefore.proposal).toBeFalsy()
    expect((await fs.readFile(glossaryFile(grilled.projectId))).equals(glossaryBefore)).toBe(true)
  })

  it('announces its status and the change to the Project’s Prototypes', async () => {
    const grilled = await kit.draftAtV1()
    const started = await kit.runPrototype(grilled, 'finished')

    const statuses = backend.events.flatMap((event) =>
      event.type === 'prototypeSession' && event.session.id === started.id ? [event.session.status] : [],
    )
    expect(statuses[0]).toBe('thinking')
    expect(statuses.at(-1)).toBe('finished')
    expect(backend.events).toContainEqual({ type: 'prototypes', projectId: grilled.projectId })
  })
})

describe('a Prototype Session that does not succeed', () => {
  it('ends Failed with no Prototype when Claude Code dies, and leaves earlier Prototypes unchanged', async () => {
    const grilled = await kit.draftAtV1()
    await kit.runPrototype(grilled, 'finished')
    const earlier = await kit.newestPrototype(grilled)
    const earlierHtml = await readPrototypeHtml(grilled.projectId, earlier.id)

    await kit.steer(grilled, 'fake:crash')
    await kit.runPrototype(grilled, 'failed')

    const rows = await kit.rowsOf(grilled)
    expect(rows.map((row) => row.kind)).toEqual(['failed', 'finished'])
    expect(rows[0]).toMatchObject({ session: { error: expect.stringContaining('Claude Code exited') } })
    expect(await getPrototype(grilled.projectId, earlier.id)).toEqual(earlier)
    expect(await readPrototypeHtml(grilled.projectId, earlier.id)).toBe(earlierHtml)
  })

  it('ends Failed when Claude ends its turn without submitting', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:no-submit')
    const started = await kit.runPrototype(grilled, 'failed')

    const record = await getPrototypeSession(grilled.projectId, started.id)
    expect(record.status).toBe('failed')
    expect(record.error).toBeTruthy()
    expect(record.prototypeId).toBeUndefined()
    await expect(fs.stat(prototypeWorkDir(started.id))).rejects.toThrow()
  })

  it('is Stopped by the human, keeps no Prototype, and can be started again', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    const started = (await kit.startPrototype(grilled)).body as PrototypeSessionSummary
    await kit.waitForRows(grilled, ['running'])

    expect((await call('POST', stopUrl(grilled, started.id))).status).toBe(200)
    await kit.waitForRows(grilled, ['stopped'])

    expect(backend.supervisor.livePrototypeForDraft(grilled.draftId)).toBeUndefined()
    expect((await getPrototypeSession(grilled.projectId, started.id)).prototypeId).toBeUndefined()
    await expect(fs.stat(prototypeWorkDir(started.id))).rejects.toThrow()
    expect((await kit.startPrototype(grilled)).status).toBe(200)
  })

  it('refuses to stop a session that is not running', async () => {
    const grilled = await kit.draftAtV1()
    const started = await kit.runPrototype(grilled, 'finished')
    expect((await call('POST', stopUrl(grilled, started.id))).status).toBe(409)
  })

  it('takes no message from the human', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    const started = (await kit.startPrototype(grilled)).body as PrototypeSessionSummary
    const said = await call('POST', `/api/sessions/${started.id}/messages`, { text: 'hello' })
    expect(said.status).toBe(409)
  })
})

describe('the lock per Draft and kind', () => {
  it('lets a Grilling Session and a Prototype Session run together on one Draft', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    const grilling = await call('POST', `${draftUrl(grilled)}/sessions`, { kind: 'iteration' })
    expect(grilling.status).toBe(200)
    await kit.waitForGrilling(grilled, 'waiting', grilling.body.id)

    const started = await kit.startPrototype(grilled)
    expect(started.status).toBe(200)

    // The chat's live session is still the Grilling Session; the Prototype Session has its own lookup.
    expect((await call('GET', draftUrl(grilled))).body.liveSession).toMatchObject({ id: grilling.body.id })
    expect(backend.supervisor.liveForDraft(grilled.draftId)?.id).toBe(grilling.body.id)
    expect(backend.supervisor.livePrototypeForDraft(grilled.draftId)?.id).toBe(started.body.id)
  })

  it('refuses a second Prototype Session on the Draft, but not one on another Draft', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    expect((await kit.startPrototype(grilled)).status).toBe(200)

    expect((await kit.startPrototype(grilled)).status).toBe(409)
    expect(await kit.kindsOf(grilled)).toEqual(['running'])

    const other = await kit.draftAtV1()
    await kit.steer(other, 'fake:hang')
    expect((await kit.startPrototype(other)).status).toBe(200)
  })

  it('starts only one of two Prototype Sessions started at once', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    const replies = await Promise.all([kit.startPrototype(grilled), kit.startPrototype(grilled)])
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])
    expect(await listPrototypeSessions(grilled.projectId, grilled.draftId)).toHaveLength(1)
  })

  it('refuses to delete the Draft while either kind of session runs on it', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    const started = (await kit.startPrototype(grilled)).body as PrototypeSessionSummary

    expect((await call('DELETE', draftUrl(grilled))).status).toBe(409)
    await call('POST', stopUrl(grilled, started.id))
    await kit.waitForRows(grilled, ['stopped'])

    const grilling = await call('POST', `${draftUrl(grilled)}/sessions`, { kind: 'iteration' })
    await kit.waitForGrilling(grilled, 'waiting', grilling.body.id)
    expect((await call('DELETE', draftUrl(grilled))).status).toBe(409)
    await call('POST', `/api/sessions/${grilling.body.id}/stop`)
    await kit.waitForGrilling(grilled, 'stopped', grilling.body.id)

    expect((await call('DELETE', draftUrl(grilled))).status).toBe(200)
    expect(await listPrototypeSessions(grilled.projectId)).toEqual([])
  })
})

describe('starting a session', () => {
  it('labels the session with the Draft version it was started from', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:hang')
    const started = (await kit.startPrototype(grilled)).body as PrototypeSessionSummary
    expect(started.draftVersion).toBe((await kit.getDraft(grilled)).version)
    expect((await getPrototypeSession(grilled.projectId, started.id)).draftVersion).toBe(started.draftVersion)
  })
})

describe('after a backend restart', () => {
  it('turns a session left running into Failed with the restart reason and removes its working folder', async () => {
    const grilled = await kit.draftAtV1()
    await savePrototypeSession({
      id: 'psess-left',
      kind: 'prototype',
      projectId: grilled.projectId,
      draftId: grilled.draftId,
      draftVersion: 1,
      status: 'thinking',
      writeConfirmed: true,
      startedAt: '2026-10-01T10:00:00.000Z',
      inputs: { tickedImages: [], extraImages: [] },
      messages: [],
    })
    await fs.mkdir(prototypeWorkDir('psess-left'), { recursive: true })

    await backend.supervisor.markInterrupted()

    const [row] = await kit.rowsOf(grilled)
    expect(row).toMatchObject({
      kind: 'failed',
      session: { id: 'psess-left', error: 'The backend restarted while this Prototype was being written' },
    })
    await expect(fs.stat(prototypeWorkDir('psess-left'))).rejects.toThrow()
  })

  it('keeps Failed and Stopped sessions as they are', async () => {
    const grilled = await kit.draftAtV1()
    await kit.steer(grilled, 'fake:no-submit')
    await kit.runPrototype(grilled, 'failed')
    const before = await kit.rowsOf(grilled)
    await backend.supervisor.markInterrupted()
    expect(await kit.rowsOf(grilled)).toEqual(before)
  })
})
