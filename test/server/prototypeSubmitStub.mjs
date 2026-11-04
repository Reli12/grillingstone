#!/usr/bin/env node
// A stand-in for scripts/writeDraft.mjs in tests that run the fake Claude without a backend: it runs the real
// Prototype submitter against the session folder (the current directory) with the payload file the session wrote,
// and leaves what would be stored in stored.html and stored.json beside it. Prints ACCEPTED or REFUSED like the
// real script.
// The session's Image map comes from GRILLINGSTONE_TEST_IMAGES (a JSON list of { number, mediaType, data }).
import fs from 'node:fs'
import path from 'node:path'

import { prototypeSubmitter } from '../../server/sessions/prototypeSubmitter.ts'

const sessionDir = process.cwd()
// Mirrors submitPayloadFile in core/session/cardProtocol.ts.
const payloadPath = path.join(sessionDir, '.submit', `${process.env.GRILLINGSTONE_SESSION_ID}.json`)
const images = JSON.parse(process.env.GRILLINGSTONE_TEST_IMAGES ?? '[]')

const submit = prototypeSubmitter({
  sessionDir,
  images,
  store: async ({ html, assumptions, usedImages }) => {
    fs.writeFileSync(path.join(sessionDir, 'stored.html'), html)
    fs.writeFileSync(path.join(sessionDir, 'stored.json'), JSON.stringify({ assumptions, usedImages }))
  },
})

const result = await submit(JSON.parse(fs.readFileSync(payloadPath, 'utf8')))
if (result.ok) {
  process.stdout.write(`ACCEPTED\n${result.message}\n`)
  process.exit(0)
}
const bullets = result.reasons.map((reason) => `- ${reason.message}`)
process.stdout.write(`REFUSED\n${bullets.join('\n')}\n`)
process.exit(1)
