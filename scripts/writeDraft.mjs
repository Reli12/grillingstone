#!/usr/bin/env node
// The Draft submit script (ADR-0004, ADR-0010). A session pipes its v1 Draft or Proposal JSON in on stdin;
// the backend validates it against the Template and either stores it or refuses with named reasons.
// Sessions can change a Draft only through this script — the Permission Guard blocks direct writes.
// Output contract: "ACCEPTED\n<message>" with exit 0, or "REFUSED\n- <reason>..." with exit 1.
import fs from 'node:fs'

const SESSION_TOKEN_HEADER = 'x-pbi-session-token'
const STDIN = 0

const server = process.env.WHETSTONE_SERVER_URL
const sessionId = process.env.WHETSTONE_SESSION_ID
const token = process.env.WHETSTONE_SESSION_TOKEN

/** Prints the refusal with one bullet per reason and exits non-zero so the session sees the tool call fail. */
function fail(reasons) {
  const bullets = reasons.map((reason) => `- ${reason}`)
  process.stdout.write(`REFUSED\n${bullets.join('\n')}\n`)
  process.exit(1)
}

function readPayload() {
  const raw = fs.readFileSync(STDIN, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    fail([`The input is not valid JSON: ${error.message}`])
  }
}

async function submit(payload) {
  const url = `${server}/api/internal/sessions/${encodeURIComponent(sessionId)}/submit`
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SESSION_TOKEN_HEADER]: token },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    fail([`Could not reach the Whetstone backend: ${error.message}`])
  }
}

if (!server || !sessionId || !token) fail(['This command only works inside a Whetstone Grilling Session.'])

const payload = readPayload()
const res = await submit(payload)
// A non-JSON response (e.g. a crash page) has no reasons to read; the HTTP status below becomes the reason.
const body = await res.json().catch(() => ({}))
if (res.ok && body.ok) {
  process.stdout.write(`ACCEPTED\n${body.message ?? ''}\n`)
  process.exit(0)
}
const fallback = { message: body.error ?? `HTTP ${res.status}` }
const reasons = body.reasons ?? [fallback]
fail(reasons.map((reason) => reason.message))
