// Tests for the fake Claude double in Prototype mode: it writes and edits prototype.html in its working folder and
// runs the submit command, here against the real Prototype submitter. Session folders are made in data-test/.
import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildMessageContent } from '#core/session/images.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { DATA_DIR } from '../config.ts'

const FAKE_CLAUDE = path.resolve('test/server/fakeClaude.mjs')
const SUBMIT_STUB = path.resolve('test/server/prototypeSubmitStub.mjs')
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

type FakeEvent = Record<string, any>

let sessionDir: string
let child: ChildProcess | undefined

beforeEach(async () => {
  await resetTestData()
  sessionDir = path.join(DATA_DIR, 'prototype-work', 'sess-1')
  await fs.mkdir(sessionDir, { recursive: true })
})
afterEach(() => child?.kill())

const inSession = (name: string) => path.join(sessionDir, name)

/** Starts the fake in Prototype mode with a Draft file and sends the seed; resolves with its events up to `until`. */
async function runFake(options: { draft: string; images?: unknown[]; until: 'result' | 'quiet' }) {
  await fs.writeFile(inSession('draft.md'), options.draft)
  const images = options.images ?? []
  const imageMap = images.length ? [{ number: 1, mediaType: 'image/png', data: PIXEL }] : []
  child = spawn(process.execPath, [FAKE_CLAUDE], {
    cwd: sessionDir,
    env: {
      ...process.env,
      GRILLINGSTONE_GUARD_MODE: 'prototype',
      GRILLINGSTONE_SUBMIT_SCRIPT: SUBMIT_STUB,
      GRILLINGSTONE_TEST_IMAGES: JSON.stringify(imageMap),
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const content = buildMessageContent('Make the Prototype.', imageMap)
  child.stdin?.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`)

  const events: FakeEvent[] = []
  const lines = readline.createInterface({ input: child.stdout! })
  const finished = new Promise<void>((resolve) => {
    lines.on('line', (line) => {
      const event = JSON.parse(line) as FakeEvent
      events.push(event)
      if (options.until === 'result' && event.type === 'result') resolve()
    })
    lines.on('close', resolve)
    if (options.until === 'quiet') setTimeout(resolve, 1000)
  })
  await finished
  return events
}

const toolUses = (events: FakeEvent[]) =>
  events
    .filter((event) => event.type === 'assistant')
    .flatMap((event) => event.message.content)
    .filter((block: FakeEvent) => block.type === 'tool_use') as { name: string; input: Record<string, string> }[]
const toolResults = (events: FakeEvent[]) =>
  events
    .filter((event) => event.type === 'user')
    .flatMap((event) => event.message.content)
    .filter((block: FakeEvent) => block.type === 'tool_result') as { content: string; is_error?: boolean }[]
const saidText = (events: FakeEvent[]) =>
  events
    .filter((event) => event.type === 'assistant')
    .flatMap((event) => event.message.content)
    .filter((block: FakeEvent) => block.type === 'text')
    .map((block: FakeEvent) => block.text as string)
    .join('\n')

describe('the fake Claude in Prototype mode', () => {
  it('reads the Draft, writes prototype.html, runs the submit command once and ends its turn', async () => {
    const events = await runFake({ draft: '# Archive device\n', until: 'result' })

    const uses = toolUses(events)
    expect(uses.map((use) => use.name)).toEqual(['Read', 'Write', 'Bash'])
    expect(uses[0].input.file_path).toBe(inSession('draft.md'))
    expect(uses[1].input.file_path).toBe(inSession('prototype.html'))
    expect(uses[2].input.command).toContain('GRILLINGSTONE_JSON')
    expect(toolResults(events).at(-1)?.content).toContain('ACCEPTED')
    expect(events.at(-1)).toMatchObject({ type: 'result', is_error: false })

    const source = await fs.readFile(inSession('prototype.html'), 'utf8')
    expect(source).toContain('<button')
    const stored = await fs.readFile(inSession('stored.html'), 'utf8')
    expect(stored).toContain('Assumptions (1)')
    expect(JSON.parse(await fs.readFile(inSession('stored.json'), 'utf8')).assumptions).toHaveLength(1)
  })

  it('names its session in an init event, like Claude Code', async () => {
    const events = await runFake({ draft: '# Archive device\n', until: 'result' })
    expect(events[0]).toMatchObject({ type: 'system', subtype: 'init' })
  })

  it('shows an Image it received in the Prototype and says which blocks reached it', async () => {
    const events = await runFake({ draft: '# Archive device\n', images: [{}], until: 'result' })
    expect(saidText(events)).toContain('Received image blocks: Image 1 (image/png')
    expect(await fs.readFile(inSession('prototype.html'), 'utf8')).toContain('src="images/1"')
    expect(await fs.readFile(inSession('stored.html'), 'utf8')).toContain(`data:image/png;base64,${PIXEL}`)
  })

  it('submits a refused Prototype first when the Draft says so, then fixes the file with Edit and submits again', async () => {
    const events = await runFake({ draft: '# Archive device\nfake:refuse-first\n', until: 'result' })

    expect(toolUses(events).map((use) => use.name)).toEqual(['Read', 'Write', 'Bash', 'Edit', 'Bash'])
    const results = toolResults(events)
    expect(results.map((result) => result.content.split('\n')[0])).toEqual(['ok', 'ok', 'REFUSED', 'ok', 'ACCEPTED'])
    expect(results.find((result) => result.content.startsWith('REFUSED'))?.is_error).toBe(true)
    expect(await fs.readFile(inSession('prototype.html'), 'utf8')).not.toContain('https://')
    await expect(fs.stat(inSession('stored.html'))).resolves.toBeTruthy()
  })

  it('stays running without a result when the Draft says to hang, and writes nothing', async () => {
    const events = await runFake({ draft: '# Archive device\nfake:hang\n', until: 'quiet' })
    expect(events.some((event) => event.type === 'result')).toBe(false)
    expect(toolUses(events).map((use) => use.name)).toEqual(['Read'])
    await expect(fs.stat(inSession('prototype.html'))).rejects.toThrow()
  })
})
