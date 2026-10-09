#!/usr/bin/env node
// Starts the real backend for the browser smoke tests: empties data-e2e/ first, so every run begins with no
// Projects, then runs server/main.ts unchanged. Playwright's webServer launches it with the e2e env.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const E2E_DATA_FOLDER = 'data-e2e'

// Refuse anything but data-e2e, so a mistyped env can never wipe the real data/ or the server tests' data-test/.
if (process.env.WHETSTONE_DATA_DIR !== E2E_DATA_FOLDER) {
  console.error(`Run with WHETSTONE_DATA_DIR=${E2E_DATA_FOLDER} (playwright.config.ts sets it).`)
  process.exit(1)
}

await fs.rm(path.join(REPO_DIR, E2E_DATA_FOLDER), { recursive: true, force: true })
await import('../server/main.ts')
