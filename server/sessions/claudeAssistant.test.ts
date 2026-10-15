// Tests for the Claude adapter, driven only through the Assistant interface against test/server/fakeClaude.mjs.
import fs from 'node:fs/promises'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { resetTestData } from '../../test/server/testBackend.ts'
import { DATA_DIR } from '../config.ts'
import type { AssistantExit, AssistantLaunch, AssistantSession } from './assistant.ts'
import { claudeAssistant } from './claudeAssistant.ts'
import type { StreamStep } from './streamEvents.ts'

const projectFolder = path.join(DATA_DIR, 'adapter-project')

const launch = (conversation: AssistantLaunch['conversation'] = { persist: true }): AssistantLaunch => ({
  sessionId: 'sess-adapter',
  token: 'token',
  scope: { cwd: projectFolder, guardMode: 'grilling', submitLabel: 'Submitted the Draft for validation' },
  seed: { systemPrompt: 'RULES', firstMessage: 'Grill this requirement.' },
  model: '',
  conversation,
})

/** A started conversation that records its steps and exit, with a way to wait for the next turn's end. */
function started(conversation?: AssistantLaunch['conversation']) {
  const steps: StreamStep[] = []
  let turnEnded = () => {}
  let exited: (exit: AssistantExit) => void = () => {}
  const exit = new Promise<AssistantExit>((resolve) => (exited = resolve))
  const session: AssistantSession = claudeAssistant.start(launch(conversation), {
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

beforeEach(async () => {
  await resetTestData()
  await fs.mkdir(projectFolder, { recursive: true })
})

describe('the Claude adapter', () => {
  it('names the conversation, shows tool calls with their outcome, and turns text into question cards', async () => {
    const { session, steps, exit, nextTurn } = started()
    await nextTurn('Grill this requirement.')

    expect(steps[0]).toEqual({ type: 'conversation', id: expect.stringMatching(/^claude-/) })
    const read = steps.find((step) => step.type === 'message' && step.message.role === 'tool')
    expect(read).toMatchObject({ message: { summary: 'Read CONTEXT.md' } })
    const readMessageId = read?.type === 'message' ? read.message.id : undefined
    expect(steps).toContainEqual({ type: 'toolResult', messageId: readMessageId, outcome: 'ok', glossaryEdited: false })
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
    const { session, steps, nextTurn } = started({ persist: true, resume: 'claude-earlier' })
    await nextTurn('Grill this requirement.')
    expect(steps[0]).toEqual({ type: 'conversation', id: 'claude-earlier' })
    session.stop()
  })

  it('reports a crash with the end of what the Assistant printed', async () => {
    const { exit, nextTurn } = started()
    await nextTurn('Grill this requirement.')
    void nextTurn('CRASH')
    expect(await exit).toEqual({
      type: 'exited',
      error: expect.stringMatching(/^Claude Code exited \(code 3\): [\s\S]*fake claude crashed$/),
    })
  })

  it('ends a stopped conversation', async () => {
    const { session, exit, nextTurn } = started()
    await nextTurn('Grill this requirement.')
    session.stop()
    expect(await exit).toMatchObject({ type: 'exited', error: expect.stringContaining('SIGTERM') })
  })
})
