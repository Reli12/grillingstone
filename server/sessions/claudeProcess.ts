// One headless `claude -p` (ADR-0001): stream-json in and out, the session's tools only, the Permission
// Guard as a PreToolUse hook (ADR-0006), and the submit script's credentials in its environment.
import { type ChildProcess, spawn } from 'node:child_process'

import { SESSION_TOOLS } from '#core/session/permissionGuard.ts'

import { HOOK_SCRIPT, SERVER_URL, SUBMIT_SCRIPT } from '../config.ts'
import type { AssistantLaunch, Conversation } from './assistant.ts'

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

export function spawnClaude(
  bin: string,
  { sessionId, token, scope, seed, model, conversation }: AssistantLaunch,
): ChildProcess {
  return spawn(bin, claudeArgs(seed.systemPrompt, model, conversation), {
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
}

/** Sends one human turn over stream-json. */
export const sendMessage = (child: ChildProcess, text: string) =>
  child.stdin?.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`)
