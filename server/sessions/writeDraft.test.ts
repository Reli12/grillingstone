// Tests for scripts/writeDraft.mjs: it reads the session's own payload file, posts it, and keeps or clears the file.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { submitPayloadFile } from '#core/session/cardProtocol.ts'

import { SUBMIT_SCRIPT } from '../config.ts'

const SESSION_DIR = path.resolve('data-test', 'write-draft-script')
const SESSION_ID = 'sess-1'
const PAYLOAD_FILE = submitPayloadFile(SESSION_ID)
const PAYLOAD_PATH = path.join(SESSION_DIR, PAYLOAD_FILE)

// A stand-in for the backend's submit route: accepts a payload with a title, refuses anything else.
let backend: Server
let serverUrl = ''

/**
 * Runs the script without blocking this process: a synchronous spawn would stall the stand-in backend above,
 * so the script's request would never be answered.
 */
function runScript(): Promise<{ status: number | null; stdout: string }> {
  const env = {
    ...process.env,
    GRILLINGSTONE_SERVER_URL: serverUrl,
    GRILLINGSTONE_SESSION_ID: SESSION_ID,
    GRILLINGSTONE_SESSION_TOKEN: 'token',
    GRILLINGSTONE_PROJECT_DIR: SESSION_DIR,
  }
  return new Promise((done) => {
    const child = execFile(process.execPath, [SUBMIT_SCRIPT], { env }, (_error, stdout) =>
      done({ status: child.exitCode, stdout }),
    )
  })
}

const writePayload = (raw: string) => {
  fs.mkdirSync(path.dirname(PAYLOAD_PATH), { recursive: true })
  fs.writeFileSync(PAYLOAD_PATH, raw)
}

beforeAll(async () => {
  backend = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    req.on('end', () => {
      const payload = JSON.parse(raw) as { title?: string }
      const body = payload.title
        ? { ok: true, message: `Draft "${payload.title}" saved.` }
        : { ok: false, reasons: [{ message: 'Title is missing.' }] }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
    })
  })
  await new Promise<void>((done) => backend.listen(0, '127.0.0.1', done))
  serverUrl = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`
})

afterAll(() => {
  backend.close()
  fs.rmSync(SESSION_DIR, { recursive: true, force: true })
})

beforeEach(() => fs.rmSync(SESSION_DIR, { recursive: true, force: true }))

describe('writeDraft.mjs', () => {
  it('refuses with a "write it first" reason when there is no payload file', async () => {
    const run = await runScript()
    expect(run.status).toBe(1)
    expect(run.stdout).toContain(
      `REFUSED\n- No submission found. Write the JSON to ${PAYLOAD_FILE} with the Write tool first`,
    )
  })

  it('refuses invalid JSON, naming the file', async () => {
    writePayload('{"title": ')
    const run = await runScript()
    expect(run.status).toBe(1)
    expect(run.stdout).toContain(`- ${PAYLOAD_FILE} is not valid JSON`)
  })

  it('submits a large payload from the file and deletes it once ACCEPTED', async () => {
    writePayload(JSON.stringify({ title: 'Archive devices', body: "It's `$(fine)`".repeat(2000) }))
    const run = await runScript()
    expect(run.stdout).toBe('ACCEPTED\nDraft "Archive devices" saved.\n')
    expect(run.status).toBe(0)
    expect(fs.existsSync(PAYLOAD_PATH)).toBe(false)
  })

  it('keeps the payload file after REFUSED so the session can edit it in place', async () => {
    writePayload('{}')
    const run = await runScript()
    expect(run.stdout).toBe('REFUSED\n- Title is missing.\n')
    expect(fs.existsSync(PAYLOAD_PATH)).toBe(true)
  })
})
