// One headless `claude -p` (ADR-0001): stream-json in and out, the session's tools only, the Permission
// Guard as a PreToolUse hook (ADR-0006), and the submit script's credentials in its environment.
import { type ChildProcess, spawn } from 'node:child_process'

import type { Seed } from '#core/session/cardProtocol.ts'
import type { ContentBlock } from '#core/session/images.ts'
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
    hooks: {
      PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `"${process.execPath}" "${HOOK_SCRIPT}"` }] }],
    },
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

/**
 * A session killed while a message is being written ends that write in EPIPE, which Node raises as an 'error' event
 * on the child's stdin. Nobody can act on it: the child is gone and its 'exit' is handled where it is watched.
 */
export function ignoreBrokenPipe(child: ChildProcess) {
  child.stdin?.on('error', () => undefined)
  return child
}

export function spawnClaude({ sessionId, token, scope, seed, model, conversation }: ClaudeLaunch): ChildProcess {
  const child = spawn(CLAUDE_BIN, claudeArgs(seed.systemPrompt, model, conversation), {
    cwd: scope.cwd,
    env: {
      ...process.env,
      GRILLINGSTONE_PROJECT_DIR: scope.cwd,
      GRILLINGSTONE_GUARD_MODE: scope.guardMode,
      GRILLINGSTONE_SUBMIT_SCRIPT: SUBMIT_SCRIPT,
      GRILLINGSTONE_SERVER_URL: SERVER_URL,
      GRILLINGSTONE_SESSION_ID: sessionId,
      GRILLINGSTONE_SESSION_TOKEN: token,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  return ignoreBrokenPipe(child)
}

/** Sends one human turn over stream-json: plain text, or a content array when the turn carries Images. */
export const sendMessage = (child: ChildProcess, content: string | ContentBlock[]) =>
  child.stdin?.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`)

/** Turns stdout chunks into parsed JSON lines; lines that are not JSON are skipped. */
export function jsonLines(onEvent: (event: Record<string, unknown>) => void) {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    let newlineAt: number
    while ((newlineAt = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineAt).trim()
      buffer = buffer.slice(newlineAt + 1)
      if (!line) continue
      let event: Record<string, unknown>
      try {
        event = JSON.parse(line) as Record<string, unknown>
      } catch {
        // Claude Code may print a non-JSON line (a warning, say); it carries no event, so it is skipped.
        continue
      }
      onEvent(event)
    }
  }
}
