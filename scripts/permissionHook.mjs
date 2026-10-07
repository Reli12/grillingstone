#!/usr/bin/env node
// PreToolUse hook for headless Grilling Sessions (ADR-0006): deny by default, decided by core/session/permissionGuard.ts.
// Reads the hook payload on stdin; the Project folder and submit script come from the session's environment.
import fs from 'node:fs'
import path from 'node:path'

import { decide } from '#core/session/permissionGuard.ts'

const ALLOWED_REASON = 'Allowed by the Whetstone session allowlist.'
const STDIN = 0

/** realpath for paths that may not exist yet: resolve the longest existing ancestor, keep the rest. */
function realpath(targetPath) {
  let head = targetPath
  const tail = []
  while (true) {
    try {
      return path.join(fs.realpathSync(head), ...tail)
    } catch {
      // `head` does not exist (yet): step up one level and retry; the walk stops at the filesystem root.
      const parent = path.dirname(head)
      if (parent === head) return targetPath
      tail.unshift(path.basename(head))
      head = parent
    }
  }
}

/** Prints the hook decision in Claude Code's PreToolUse format and exits; the decision itself carries allow/deny. */
const respondAndExit = (permissionDecision, permissionDecisionReason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason },
    }),
  )
  process.exit(0)
}

try {
  const input = JSON.parse(fs.readFileSync(STDIN, 'utf8'))
  const projectDir = process.env.WHETSTONE_PROJECT_DIR
  const submitScript = process.env.WHETSTONE_SUBMIT_SCRIPT
  if (!projectDir || !submitScript)
    respondAndExit('deny', 'Session environment is missing WHETSTONE_PROJECT_DIR / WHETSTONE_SUBMIT_SCRIPT.')
  const mode = process.env.WHETSTONE_GUARD_MODE === 'template' ? 'template' : 'grilling'
  const decision = decide(input.tool_name, input.tool_input ?? {}, {
    projectDir: realpath(projectDir),
    submitScript,
    realpath,
    mode,
  })
  const permission = decision.allow ? 'allow' : 'deny'
  const reason = decision.allow ? ALLOWED_REASON : decision.reason
  respondAndExit(permission, reason)
} catch (error) {
  // Any failure (bad payload, guard crash) denies the tool call rather than letting it through.
  const message = error instanceof Error ? error.message : String(error)
  respondAndExit('deny', `Permission hook failed: ${message}`)
}
