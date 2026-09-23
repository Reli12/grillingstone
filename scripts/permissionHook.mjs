#!/usr/bin/env node
// PreToolUse hook for headless Grilling Sessions (ADR-0006): deny by default, decided by core/session/permissionGuard.ts.
// Reads the hook payload on stdin; the Project folder and submit script come from the session's environment.
import fs from 'node:fs'
import path from 'node:path'
import { decide } from '#core/session/permissionGuard.ts'

/** realpath for paths that may not exist yet: resolve the longest existing ancestor, keep the rest. */
function realpath(p) {
  let head = p
  const tail = []
  while (true) {
    try {
      return path.join(fs.realpathSync(head), ...tail)
    } catch {
      const parent = path.dirname(head)
      if (parent === head) return p
      tail.unshift(path.basename(head))
      head = parent
    }
  }
}

const out = (permissionDecision, permissionDecisionReason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason } }))
  process.exit(0)
}

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'))
  const projectDir = process.env.WHETSTONE_PROJECT_DIR
  const submitScript = process.env.WHETSTONE_SUBMIT_SCRIPT
  if (!projectDir || !submitScript) out('deny', 'Session environment is missing WHETSTONE_PROJECT_DIR / WHETSTONE_SUBMIT_SCRIPT.')
  const mode = process.env.WHETSTONE_GUARD_MODE === 'template' ? 'template' : 'grilling'
  const d = decide(input.tool_name, input.tool_input ?? {}, { projectDir: realpath(projectDir), submitScript, realpath, mode })
  out(d.allow ? 'allow' : 'deny', d.allow ? 'Allowed by the Whetstone session allowlist.' : d.reason)
} catch (e) {
  out('deny', `Permission hook failed: ${e instanceof Error ? e.message : String(e)}`)
}
