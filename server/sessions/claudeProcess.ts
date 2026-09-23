// One headless `claude -p` (ADR-0001): stream-json in and out, the session's tools only, the Permission
// Guard as a PreToolUse hook (ADR-0006), and the submit script's credentials in its environment.
import { spawn, type ChildProcess } from 'node:child_process'
import type { Seed } from '#core/session/cardProtocol.ts'
import { SESSION_TOOLS } from '#core/session/permissionGuard.ts'
import { CLAUDE_BIN, HOOK_SCRIPT, SERVER_URL, SUBMIT_SCRIPT } from '../config.ts'
import type { Scope } from './sessionScope.ts'

export interface ClaudeLaunch {
  sessionId: string
  /** Authenticates the submit script's call back to the backend. */
  token: string
  scope: Pick<Scope, 'cwd' | 'guardMode'>
  seed: Seed
  /** '' for Claude Code's default. */
  model: string
  conversation: Conversation
}

/** Whether Claude Code keeps the conversation so it can be continued, and which one to continue (ADR-0014). */
export interface Conversation {
  persist: boolean
  resume?: string
}

export function claudeArgs(systemPrompt: string, model: string, { persist, resume }: Conversation): string[] {
  const settings = JSON.stringify({
    hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `"${process.execPath}" "${HOOK_SCRIPT}"` }] }] },
  })
  // prettier-ignore
  return [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--append-system-prompt', systemPrompt,
    '--tools', SESSION_TOOLS.join(','),
    '--permission-prompts', 'none',
    '--strict-mcp-config',
    ...(persist ? [] : ['--no-session-persistence']),
    ...(resume ? ['--resume', resume] : []),
    '--settings', settings,
    ...(model ? ['--model', model] : []),
  ]
}

export function spawnClaude({ sessionId, token, scope, seed, model, conversation }: ClaudeLaunch): ChildProcess {
  return spawn(CLAUDE_BIN, claudeArgs(seed.systemPrompt, model, conversation), {
    cwd: scope.cwd,
    env: {
      ...process.env,
      WHETSTONE_PROJECT_DIR: scope.cwd,
      WHETSTONE_GUARD_MODE: scope.guardMode,
      WHETSTONE_SUBMIT_SCRIPT: SUBMIT_SCRIPT,
      WHETSTONE_SERVER_URL: SERVER_URL,
      WHETSTONE_SESSION_ID: sessionId,
      WHETSTONE_SESSION_TOKEN: token,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

/** Sends one human turn over stream-json. */
export const sendMessage = (child: ChildProcess, text: string) => child.stdin?.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`)

/** Turns stdout chunks into parsed JSON lines; lines that are not JSON are skipped. */
export function jsonLines(onEvent: (event: Record<string, unknown>) => void) {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let event: Record<string, unknown>
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      onEvent(event)
    }
  }
}
