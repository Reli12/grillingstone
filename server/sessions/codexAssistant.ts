// The Codex adapter behind the Assistant seam: one `codex app-server` per session, held to its folder by the
// sandbox profile (ADR-0019). Its notifications become steps, and every request it sends out goes to the Guard.
import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Availability } from '#core/contract/apiTypes.ts'
import { ASSISTANT_SETUP } from '#core/session/assistantName.ts'
import { SUBMIT_TOOL } from '#core/session/cardProtocol.ts'
import { codexConfig, configArgs } from '#core/session/codexProfile.ts'
import { CODEX_APPROVAL_REQUESTS, decideCodexRequest } from '#core/session/permissionGuard.ts'

import { CODEX_BIN, DATA_DIR } from '../config.ts'
import type { Assistant, AssistantEvents, AssistantLaunch, AssistantSession } from './assistant.ts'
import { followExit, runStatus, STOP_GRACE_MS, stopper } from './assistantProcess.ts'
import { turnFailedSteps } from './chatMessages.ts'
import { readCodexNotification } from './codexEvents.ts'
import { type CodexRpc, codexRpc, type IncomingRequest } from './codexRpc.ts'
import type { SubmitResult } from './sessionScope.ts'
import type { KnownTool, StreamStep } from './streamEvents.ts'

/** Each running session's own temp folder lives here: shells need one, and the system temp folders are denied. */
export const SESSION_TMP_DIR = path.join(DATA_DIR, 'session-tmp')

/** Where Codex keeps its sign-in, threads and helpers, as Codex itself resolves it. */
const CODEX_HOME = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
/** Folders commands must read to run at all: the Node install Codex and its bundled ripgrep live in. */
const RUNTIME_READ_PATHS = [path.dirname(path.dirname(process.execPath))]
/** Codex asks before anything leaves the sandbox; commands that stay inside run without asking. */
const APPROVAL_POLICY = 'on-request'
const CLIENT_INFO = { name: 'grillingstone', version: '1' }

/** The backend tool a session submits through: app-server sends its calls to the backend (ADR-0019). */
const SUBMIT_TOOL_SPEC = {
  type: 'function',
  name: SUBMIT_TOOL,
  description: 'Submits the JSON for validation. Answers ACCEPTED, or REFUSED with the reasons.',
  inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
}

/** The submit tool's answer, in the submit script's words, so both Assistants read the same reply. */
function submitReply(result: SubmitResult): string {
  if (result.ok) return `ACCEPTED\n${result.message}`
  const bullets = result.reasons.map((reason) => `- ${reason.message}`)
  return `REFUSED\n${bullets.join('\n')}`
}

const toolResult = (text: string, success: boolean) => ({ contentItems: [{ type: 'inputText', text }], success })

async function submitted(launch: AssistantLaunch, params: Record<string, unknown>) {
  const { payload } = (params.arguments ?? {}) as { payload?: unknown }
  try {
    const result = await launch.submit(payload)
    return toolResult(submitReply(result), result.ok)
  } catch (error) {
    return toolResult(`REFUSED\n- ${(error as Error).message}`, false)
  }
}

/** Answers a request app-server sends the backend: the Guard decides, and only submit_draft gets through. */
async function answer(rpc: CodexRpc, { id, method, params }: IncomingRequest, launch: AssistantLaunch) {
  const decision = decideCodexRequest(method, params)
  if (decision.allow) rpc.respond(id, await submitted(launch, params))
  else if (method === 'item/tool/call') rpc.respond(id, toolResult(decision.reason, false))
  // Approval requests are answered with a decision; any other request the Guard refuses gets an error.
  else if (CODEX_APPROVAL_REQUESTS.includes(method)) rpc.respond(id, { decision: 'decline' })
  else rpc.refuse(id, decision.reason)
}

/** A new thread for a new session, or the ended session's thread for a Continuation (ADR-0014). */
function threadRequest({ scope, seed, model, conversation }: AssistantLaunch): [string, Record<string, unknown>] {
  const settings = {
    cwd: scope.cwd,
    approvalPolicy: APPROVAL_POLICY,
    developerInstructions: seed.systemPrompt,
    ...(model ? { model } : {}),
  }
  if (conversation.resume) return ['thread/resume', { ...settings, threadId: conversation.resume }]
  return ['thread/start', { ...settings, ephemeral: !conversation.persist, dynamicTools: [SUBMIT_TOOL_SPEC] }]
}

/** Opens the conversation and names it; resolves with the thread id every turn goes to. */
async function openThread(rpc: CodexRpc, launch: AssistantLaunch, events: AssistantEvents): Promise<string> {
  // dynamicTools is experimental: app-server accepts it only from a client that says it uses the experimental API.
  await rpc.request('initialize', { clientInfo: CLIENT_INFO, capabilities: { experimentalApi: true } })
  rpc.notify('initialized')
  const [method, params] = threadRequest(launch)
  const result = await rpc.request(method, params)
  const threadId = (result.thread as { id?: unknown } | undefined)?.id
  if (typeof threadId !== 'string') throw new Error(`${method} named no thread.`)
  events.onStep({ type: 'conversation', id: threadId })
  return threadId
}

function spawnCodex(bin: string, launch: AssistantLaunch, sessionTmp: string): ChildProcess {
  const { cwd, guardMode } = launch.scope
  const config = codexConfig({
    projectDir: cwd,
    mode: guardMode,
    sessionTmp,
    runtimeReadPaths: RUNTIME_READ_PATHS,
    platform: process.platform,
    codexHome: CODEX_HOME,
  })
  return spawn(bin, ['app-server', ...configArgs(config)], { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
}

/** A turn Codex would not start ends at once, with its reason, so the session does not wait for it forever. */
const turnRefusedSteps = (error: Error) => turnFailedSteps(`Codex could not start the turn: ${error.message}`)

/** Human turns, one at a time: the next starts once Codex has ended the one before. */
function turnQueue() {
  let queue: Promise<unknown> = Promise.resolve()
  let turnEnded = () => {}
  const runTurn = async (startTurn: () => Promise<unknown>) => {
    const ended = new Promise<void>((resolve) => (turnEnded = resolve))
    await startTurn()
    await ended
  }
  return {
    /** Starts a turn once the turns before it have ended. */
    add: (startTurn: () => Promise<unknown>) => {
      // A turn fails only when Codex is going away; its exit is reported, so the failure itself is not.
      queue = queue.then(() => runTurn(startTurn)).catch(() => {})
    },
    /** Settles once every turn added so far has ended. */
    drained: () => queue,
    /** Codex reported the end of the current turn. */
    onTurnEnded: () => turnEnded(),
  }
}

/** Passes steps on to the Supervisor, remembering tool messages so their end can update them. */
function stepSink(launch: AssistantLaunch, events: AssistantEvents, onTurnEnded: () => void) {
  /** item id → the tool message showing it. */
  const tools = new Map<string, KnownTool>()
  const onSteps = (...steps: StreamStep[]) => {
    for (const step of steps) {
      if (step.type === 'message' && step.toolUseId && step.tool) tools.set(step.toolUseId, step.tool)
      events.onStep(step)
      if (step.type === 'turnEnded') onTurnEnded()
    }
  }
  const context = { cwd: launch.scope.cwd, submitLabel: launch.scope.submitLabel, tools }
  return Object.assign(onSteps, { context })
}

function start(bin: string, launch: AssistantLaunch, events: AssistantEvents): AssistantSession {
  const sessionTmp = path.join(SESSION_TMP_DIR, launch.sessionId)
  fs.mkdirSync(sessionTmp, { recursive: true })
  const child = spawnCodex(bin, launch, sessionTmp)
  const removeTmp = () => fs.rmSync(sessionTmp, { recursive: true, force: true })
  const explainExit = followExit(child, { label: 'Codex', bin, events, onGone: removeTmp })
  const { running, stop } = stopper(child)

  const turns = turnQueue()
  const onStep = stepSink(launch, events, turns.onTurnEnded)
  const rpc: CodexRpc = codexRpc(child, {
    onNotification: (method, params) => onStep(...readCodexNotification(method, params, onStep.context)),
    onRequest: (request) => void answer(rpc, request, launch),
  })

  const thread = openThread(rpc, launch, events)
  thread.catch((error: Error) => {
    explainExit(error.message)
    stop()
  })

  const startTurn = async (text: string) => {
    const input = [{ type: 'text', text, text_elements: [] }]
    // A thread that never opened rejects here, and that session is already being stopped.
    const threadId = await thread
    try {
      await rpc.request('turn/start', { threadId, input })
    } catch (error) {
      // A Codex that has exited is reported by its exit; one still running refused only this turn.
      if (running()) onStep(...turnRefusedSteps(error as Error))
    }
  }

  return {
    send: (text) => turns.add(() => startTurn(text)),
    close: () => {
      void turns.drained().then(() => {
        child.stdin?.end()
        setTimeout(stop, STOP_GRACE_MS).unref()
      })
    },
    stop,
  }
}

/**
 * Where Codex's sandbox has been checked against this profile: macOS (Seatbelt) and Linux (bubblewrap). Native
 * Windows has neither, and a session must never run unguarded (ADR-0019), so there Codex isn't offered at all.
 */
const SANDBOXED_PLATFORMS: NodeJS.Platform[] = ['darwin', 'linux']
const UNSUPPORTED_PLATFORM_FIX =
  'Codex isn’t available on native Windows yet: its sandbox there hasn’t been checked against Grilling Stone’s, so sessions would not be guarded. Run Grilling Stone in Docker or WSL2 to use Codex, or choose Claude.'

/** Installed and signed in, from `codex login status`, which exits 0 only when signed in. */
async function checkAvailability(bin: string, platform: NodeJS.Platform): Promise<Availability> {
  if (!SANDBOXED_PLATFORMS.includes(platform)) return { ready: false, fix: UNSUPPORTED_PLATFORM_FIX }
  const status = await runStatus(bin, ['login', 'status'])
  if (!status.found)
    return {
      ready: false,
      fix: `Codex isn’t installed (looked for \`${bin}\`). Install it with \`${ASSISTANT_SETUP.codex.install}\`, or point GRILLINGSTONE_CODEX_BIN at it.`,
    }
  if (status.code === 0) return { ready: true }
  return {
    ready: false,
    fix: `Codex isn’t signed in. Run \`${ASSISTANT_SETUP.codex.signIn}\` in a terminal, then try again.`,
  }
}

/** The Codex adapter for the `codex` binary at `bin`, on this machine's platform unless a test names another. */
export const codexAssistantAt = (bin: string, platform: NodeJS.Platform = process.platform): Assistant => ({
  name: 'codex',
  submitVia: { tool: SUBMIT_TOOL },
  checkAvailability: () => checkAvailability(bin, platform),
  start: (launch, events) => start(bin, launch, events),
})

export const codexAssistant = codexAssistantAt(CODEX_BIN)
