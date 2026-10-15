// Tests for the Assistant adapters, driven only through the Assistant interface: each against its fake
// (test/server/fakeClaude.mjs, test/server/fakeCodex.mjs), so both keep the same behaviour.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it } from 'vitest'

import { resetTestData } from '../../test/server/testBackend.ts'
import { DATA_DIR } from '../config.ts'
import type { Assistant, AssistantExit, AssistantLaunch, AssistantSession } from './assistant.ts'
import { claudeAssistantAt } from './claudeAssistant.ts'
import { codexAssistantAt, SESSION_TMP_DIR } from './codexAssistant.ts'
import type { SubmitResult } from './sessionScope.ts'
import type { StreamStep } from './streamEvents.ts'

const projectFolder = path.join(DATA_DIR, 'adapter-project')
const fake = (name: string) => fileURLToPath(new URL(`../../test/server/${name}`, import.meta.url))
const MISSING_BINARY = path.join(DATA_DIR, 'no-such-assistant')

let sessionCount = 0

const ACCEPTED: SubmitResult = { ok: true, message: 'Draft v1 written.' }

interface Options {
  conversation?: AssistantLaunch['conversation']
  submit?: AssistantLaunch['submit']
}

const launch = ({
  conversation = { persist: true },
  submit = () => Promise.resolve(ACCEPTED),
}: Options): AssistantLaunch => ({
  sessionId: `sess-adapter-${++sessionCount}`,
  token: 'token',
  scope: { cwd: projectFolder, guardMode: 'grilling', submitLabel: 'Submitted the Draft for validation' },
  seed: { systemPrompt: 'RULES', firstMessage: 'Grill this requirement.' },
  model: '',
  conversation,
  submit,
})

/** A started conversation that records its steps and exit, with a way to wait for the next turn's end. */
function started(assistant: Assistant, options: Options = {}) {
  const steps: StreamStep[] = []
  let turnEnded = () => {}
  let exited: (exit: AssistantExit) => void = () => {}
  const exit = new Promise<AssistantExit>((resolve) => (exited = resolve))
  const session: AssistantSession = assistant.start(launch(options), {
    onStep: (step) => {
      steps.push(step)
      if (step.type === 'turnEnded') turnEnded()
    },
    onExit: (assistantExit) => exited(assistantExit),
  })
  const nextTurn = (text: string) => {
    const ended = new Promise<void>((resolve) => (turnEnded = resolve))
    session.send(text)
    return ended
  }
  return { session, steps, exit, nextTurn }
}

const toolMessages = (steps: StreamStep[]) =>
  steps.flatMap((step) => (step.type === 'message' && step.message.role === 'tool' ? [step.message] : []))

const outcomeOf = (steps: StreamStep[], messageId: string) =>
  steps.find((step) => step.type === 'toolResult' && step.messageId === messageId)

beforeEach(async () => {
  await resetTestData()
  await fs.mkdir(projectFolder, { recursive: true })
})

describe.each([
  { label: 'Claude Code', at: claudeAssistantAt, bin: fake('fakeClaude.mjs'), prefix: 'claude' },
  { label: 'Codex', at: codexAssistantAt, bin: fake('fakeCodex.mjs'), prefix: 'codex' },
])('the $label adapter', ({ label, at, bin, prefix }) => {
  const assistant = at(bin)

  it('names the conversation, shows tool calls with their outcome, and turns text into question cards', async () => {
    const { session, steps, exit, nextTurn } = started(assistant)
    await nextTurn('Grill this requirement.')

    expect(steps[0]).toEqual({ type: 'conversation', id: expect.stringMatching(new RegExp(`^${prefix}-`)) })
    const [read] = toolMessages(steps)
    expect(read).toMatchObject({ summary: 'Read CONTEXT.md' })
    expect(outcomeOf(steps, read.id)).toEqual({
      type: 'toolResult',
      messageId: read.id,
      outcome: 'ok',
      glossaryEdited: false,
    })
    expect(steps).toContainEqual({
      type: 'message',
      message: expect.objectContaining({
        role: 'claude',
        segments: expect.arrayContaining([expect.objectContaining({ type: 'question' })]),
      }),
    })
    expect(steps.at(-1)).toEqual({ type: 'turnEnded' })

    session.close()
    expect(await exit).toMatchObject({ type: 'exited' })
  })

  it('resumes the conversation it is given', async () => {
    const { session, steps, nextTurn } = started(assistant, {
      conversation: { persist: true, resume: `${prefix}-earlier` },
    })
    await nextTurn('Grill this requirement.')
    expect(steps[0]).toEqual({ type: 'conversation', id: `${prefix}-earlier` })
    session.stop()
  })

  it('reports a crash with the end of what the Assistant printed', async () => {
    const { exit, nextTurn } = started(assistant)
    await nextTurn('Grill this requirement.')
    void nextTurn('CRASH')
    expect(await exit).toEqual({
      type: 'exited',
      error: expect.stringMatching(new RegExp(`^${label} exited \\(code 3\\): [\\s\\S]*fake ${prefix} crashed$`)),
    })
  })

  it('ends a stopped conversation', async () => {
    const { session, exit, nextTurn } = started(assistant)
    await nextTurn('Grill this requirement.')
    session.stop()
    expect(await exit).toMatchObject({ type: 'exited', error: expect.stringContaining('SIGTERM') })
  })

  it('reports an Assistant that cannot be started', async () => {
    const { exit } = started(at(MISSING_BINARY))
    expect(await exit).toEqual({
      type: 'spawnFailed',
      error: expect.stringContaining(`Could not start ${label} (${MISSING_BINARY})`),
    })
  })
})

describe('the Codex adapter', () => {
  const codex = codexAssistantAt(fake('fakeCodex.mjs'))

  it("hands a submit_draft call to the session's submit, and Codex the answer", async () => {
    const submitted: unknown[] = []
    const submit = (payload: unknown) => {
      submitted.push(payload)
      return Promise.resolve(ACCEPTED)
    }
    const { session, steps, nextTurn } = started(codex, { submit })
    await nextTurn('Grill this requirement.')
    await nextTurn('Write it now.')

    expect(submitted).toEqual([expect.objectContaining({ title: expect.any(String), sections: expect.any(Array) })])
    const submission = toolMessages(steps).find((message) => message.summary === 'Submitted the Draft for validation')
    expect(outcomeOf(steps, submission!.id)).toMatchObject({ outcome: 'ok' })
    // fakeCodex.mjs says "Written." when the tool answered ACCEPTED.
    expect(steps).toContainEqual({
      type: 'message',
      message: expect.objectContaining({ segments: [{ type: 'text', text: 'Written.' }] }),
    })
    session.stop()
  })

  it('shows a refused submission as an error, and passes the reasons to Codex', async () => {
    const refused: SubmitResult = { ok: false, reasons: [{ code: 'x', message: 'No title.' }] }
    const submit = () => Promise.resolve(refused)
    const { session, steps, nextTurn } = started(codex, { submit })
    await nextTurn('Write it now.')

    const submission = toolMessages(steps).find((message) => message.summary === 'Submitted the Draft for validation')
    expect(outcomeOf(steps, submission!.id)).toMatchObject({ outcome: 'error' })
    // fakeCodex.mjs repeats the refusal it got back.
    expect(steps).toContainEqual({
      type: 'message',
      message: expect.objectContaining({ segments: [{ type: 'text', text: 'Refused: REFUSED\n- No title.' }] }),
    })
    session.stop()
  })

  it('declines a command that asks to leave the sandbox, and shows it as refused', async () => {
    const { session, steps, nextTurn } = started(codex)
    // fakeCodex.mjs asks approval to read outside the Project when a message says OUTSIDE.
    await nextTurn('OUTSIDE')
    const escape = toolMessages(steps).find((message) => message.summary.includes('.ssh'))
    expect(outcomeOf(steps, escape!.id)).toMatchObject({ outcome: 'denied' })
    session.stop()
  })

  it('ends a turn Codex refused to start, with its reason, so the human can carry on', async () => {
    const { session, steps, nextTurn } = started(codex)
    await nextTurn('Grill this requirement.')
    // fakeCodex.mjs refuses turn/start for a message that says REJECT.
    await nextTurn('REJECT')
    expect(steps.slice(-2)).toEqual([
      {
        type: 'message',
        message: expect.objectContaining({ role: 'system', tone: 'error', text: expect.stringContaining('rejected') }),
      },
      { type: 'turnEnded' },
    ])
    session.stop()
  })

  it('shows a call to a tool other than submit_draft as refused', async () => {
    const { session, steps, nextTurn } = started(codex)
    // fakeCodex.mjs calls a tool the backend never registered when a message says OTHER_TOOL.
    await nextTurn('OTHER_TOOL')
    const call = toolMessages(steps).find((message) => message.summary === 'Tried to use other_tool')
    expect(outcomeOf(steps, call!.id)).toMatchObject({ outcome: 'denied' })
    session.stop()
  })

  it('removes the session temp folder once Codex has exited', async () => {
    const { session, exit, nextTurn } = started(codex)
    await nextTurn('Grill this requirement.')
    const sessionId = `sess-adapter-${sessionCount}`
    expect(await fs.readdir(SESSION_TMP_DIR)).toContain(sessionId)
    session.stop()
    await exit
    expect(await fs.readdir(SESSION_TMP_DIR)).not.toContain(sessionId)
  })
})
