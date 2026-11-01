#!/usr/bin/env node
// The Draft submit script (ADR-0004, ADR-0010). A session writes its v1 Draft, Proposal or Template JSON to
// .submit/<session id>.json and runs this script with no arguments; the backend validates it against the Template
// and either stores it or refuses with named reasons. The JSON travels in a file because Windows mangles long
// command lines.
// Sessions can change a Draft only through this script — the Permission Guard blocks direct writes.
// Output contract: "ACCEPTED\n<message>" with exit 0, or "REFUSED\n- <reason>..." with exit 1.
import fs from 'node:fs'
import path from 'node:path'

const SESSION_TOKEN_HEADER = 'x-pbi-session-token'
// Mirrors SUBMIT_DIR in core/session/cardProtocol.ts, inside the session's working folder.
const SUBMIT_DIR = '.submit'

const server = process.env.GRILLINGSTONE_SERVER_URL
const sessionId = process.env.GRILLINGSTONE_SESSION_ID
const token = process.env.GRILLINGSTONE_SESSION_TOKEN
const sessionDir = process.env.GRILLINGSTONE_PROJECT_DIR

/** Prints the refusal with one bullet per reason and exits non-zero so the session sees the tool call fail. */
function fail(reasons) {
  const bullets = reasons.map((reason) => `- ${reason}`)
  process.stdout.write(`REFUSED\n${bullets.join('\n')}\n`)
  process.exit(1)
}

function readPayload(payloadPath, payloadFile) {
  let raw
  try {
    raw = fs.readFileSync(payloadPath, 'utf8')
  } catch {
    // Any read failure means there is nothing to submit; the reason tells the session how to fix it.
    fail([`No submission found. Write the JSON to ${payloadFile} with the Write tool first, then run this command.`])
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    fail([`${payloadFile} is not valid JSON: ${error.message}. Fix the file with Edit and run this command again.`])
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
    fail([`Could not reach the Grilling Stone backend: ${error.message}`])
  }
}

if (!server || !sessionId || !token || !sessionDir) fail(['This command only works inside a Grilling Stone session.'])

// Mirrors submitPayloadFile in core/session/cardProtocol.ts: one file per session.
const payloadFile = `${SUBMIT_DIR}/${sessionId}.json`
const payloadPath = path.join(sessionDir, payloadFile)
const payload = readPayload(payloadPath, payloadFile)
const res = await submit(payload)
// A non-JSON response (e.g. a crash page) has no reasons to read; the HTTP status below becomes the reason.
const body = await res.json().catch(() => ({}))
if (res.ok && body.ok) {
  // Cleared only once accepted, so a refused payload stays for the session to edit in place.
  fs.rmSync(payloadPath, { force: true })
  process.stdout.write(`ACCEPTED\n${body.message ?? ''}\n`)
  process.exit(0)
}
const fallback = { message: body.error ?? `HTTP ${res.status}` }
const reasons = body.reasons ?? [fallback]
fail(reasons.map((reason) => reason.message))
