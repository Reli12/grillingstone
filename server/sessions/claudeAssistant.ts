// The Claude adapter behind the Assistant seam: one headless `claude -p` per session, its stream-json read
// into steps, its stderr kept so a crash can be explained.
import type { ChildProcess } from 'node:child_process'

import { CLAUDE_BIN } from '../config.ts'
import type { Assistant, AssistantEvents, AssistantLaunch, AssistantSession } from './assistant.ts'
import { jsonLines, sendMessage, spawnClaude } from './claudeProcess.ts'
import { type KnownTool, readStreamEvent } from './streamEvents.ts'

/** How much of Claude Code's stderr is kept, so a crash can be explained without holding all of it. */
const STDERR_TAIL_CHARS = 4000
/** How many of the last stderr lines go into a crashed session's error. */
const STDERR_LINES_IN_ERROR = 5
/** How long a stopped session gets to exit on SIGTERM before it is killed. */
const STOP_GRACE_MS = 3000

/** How Claude Code exited, then the end of its stderr. */
function exitError(stderrTail: string, code: number | null, signal: NodeJS.Signals | null) {
  const tail = stderrTail.trim().split('\n').slice(-STDERR_LINES_IN_ERROR).join('\n')
  const how = signal ?? `code ${code}`
  const detail = tail ? `: ${tail}` : '.'
  return `Claude Code exited (${how})${detail}`
}

/** Feeds Claude Code's stdout, stderr and exit to the Supervisor's events. */
function follow(child: ChildProcess, launch: AssistantLaunch, events: AssistantEvents) {
  /** tool_use id → the tool message showing it, so its result can update that message. */
  const tools = new Map<string, KnownTool>()
  const context = { cwd: launch.scope.cwd, submitLabel: launch.scope.submitLabel, tools }
  let stderrTail = ''

  child.stdout!.setEncoding('utf8')
  child.stdout!.on(
    'data',
    jsonLines((event) => {
      for (const step of readStreamEvent(event, context)) {
        if (step.type === 'message' && step.toolUseId && step.tool) tools.set(step.toolUseId, step.tool)
        events.onStep(step)
      }
    }),
  )
  child.stderr!.setEncoding('utf8')
  child.stderr!.on('data', (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL_CHARS)
  })
  child.on('error', (error) =>
    events.onExit({ type: 'spawnFailed', error: `Could not start Claude Code (${CLAUDE_BIN}): ${error.message}` }),
  )
  // 'close', not 'exit': it fires only after stdout is fully read, so no step lands after the exit.
  child.on('close', (code, signal) => events.onExit({ type: 'exited', error: exitError(stderrTail, code, signal) }))
}

function start(launch: AssistantLaunch, events: AssistantEvents): AssistantSession {
  const child = spawnClaude(launch)
  follow(child, launch, events)
  const running = () => child.exitCode === null && child.signalCode === null
  return {
    send: (text) => void sendMessage(child, text),
    close: () => void child.stdin?.end(),
    stop: () => {
      if (!running()) return
      child.kill('SIGTERM')
      const killIfStillRunning = () => running() && child.kill('SIGKILL')
      setTimeout(killIfStillRunning, STOP_GRACE_MS).unref()
    },
  }
}

export const claudeAssistant: Assistant = { name: 'claude', start }
