// The Claude adapter behind the Assistant seam: one headless `claude -p` per session, its stream-json read
// into steps, its stderr kept so a crash can be explained.
import type { ChildProcess } from 'node:child_process'

import type { Availability } from '#core/contract/apiTypes.ts'
import { ASSISTANT_SETUP } from '#core/session/assistantName.ts'

import { CLAUDE_BIN, SUBMIT_SCRIPT } from '../config.ts'
import type { Assistant, AssistantEvents, AssistantLaunch, AssistantSession } from './assistant.ts'
import { followExit, runStatus, stopper } from './assistantProcess.ts'
import { sendMessage, spawnClaude } from './claudeProcess.ts'
import { jsonLines } from './jsonLines.ts'
import { type KnownTool, readStreamEvent } from './streamEvents.ts'

/** Feeds Claude Code's stdout to the Supervisor's events. */
function followSteps(child: ChildProcess, launch: AssistantLaunch, events: AssistantEvents) {
  /** tool_use id → the tool message showing it, so its result can update that message. */
  const tools = new Map<string, KnownTool>()
  const context = { cwd: launch.scope.cwd, submitLabel: launch.scope.submitLabel, tools }

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
}

function start(bin: string, launch: AssistantLaunch, events: AssistantEvents): AssistantSession {
  const child = spawnClaude(bin, launch)
  followSteps(child, launch, events)
  followExit(child, { label: 'Claude Code', bin, events })
  return {
    send: (text) => void sendMessage(child, text),
    close: () => void child.stdin?.end(),
    stop: stopper(child).stop,
  }
}

/** Installed and signed in, from `claude auth status`, which prints JSON with `loggedIn`. */
async function checkAvailability(bin: string): Promise<Availability> {
  const status = await runStatus(bin, ['auth', 'status', '--json'])
  if (!status.found)
    return {
      ready: false,
      fix: `Claude Code isn’t installed (looked for \`${bin}\`). Install it with \`${ASSISTANT_SETUP.claude.install}\`, or point GRILLINGSTONE_CLAUDE_BIN at it.`,
    }
  if (signedIn(status.stdout)) return { ready: true }
  return {
    ready: false,
    fix: `Claude Code isn’t signed in. Run \`${ASSISTANT_SETUP.claude.signIn}\` in a terminal, then try again.`,
  }
}

/** Whether `claude auth status --json` says it is signed in; output that is not that JSON means it is not. */
function signedIn(stdout: string): boolean {
  try {
    return (JSON.parse(stdout) as { loggedIn?: unknown }).loggedIn === true
  } catch {
    // Not the JSON status (an old version, an error page): nothing says it is signed in.
    return false
  }
}

/** The Claude adapter for the `claude` binary at `bin`. */
export const claudeAssistantAt = (bin: string): Assistant => ({
  name: 'claude',
  submitVia: { command: `node "${SUBMIT_SCRIPT}"` },
  checkAvailability: () => checkAvailability(bin),
  start: (launch, events) => start(bin, launch, events),
})

export const claudeAssistant = claudeAssistantAt(CLAUDE_BIN)
