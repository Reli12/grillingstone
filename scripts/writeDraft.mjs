#!/usr/bin/env node
// The Draft submit script (ADR-0004, ADR-0010). A session pipes its v1 Draft or Proposal JSON in on stdin;
// the backend validates it against the Template and either stores it or refuses with named reasons.
// Sessions can change a Draft only through this script — the Permission Guard blocks direct writes.
import fs from 'node:fs'

const server = process.env.WHETSTONE_SERVER_URL
const sessionId = process.env.WHETSTONE_SESSION_ID
const token = process.env.WHETSTONE_SESSION_TOKEN

function fail(lines) {
  process.stdout.write(`REFUSED\n${lines.map((l) => `- ${l}`).join('\n')}\n`)
  process.exit(1)
}

if (!server || !sessionId || !token) fail(['This command only works inside a Whetstone Grilling Session.'])

const raw = fs.readFileSync(0, 'utf8')
let payload
try {
  payload = JSON.parse(raw)
} catch (e) {
  fail([`The input is not valid JSON: ${e.message}`])
}

let res
try {
  res = await fetch(`${server}/api/internal/sessions/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pbi-session-token': token },
    body: JSON.stringify(payload),
  })
} catch (e) {
  fail([`Could not reach the Whetstone backend: ${e.message}`])
}
const body = await res.json().catch(() => ({}))
if (res.ok && body.ok) {
  process.stdout.write(`ACCEPTED\n${body.message ?? ''}\n`)
  process.exit(0)
}
fail((body.reasons ?? [{ message: body.error ?? `HTTP ${res.status}` }]).map((r) => r.message))
