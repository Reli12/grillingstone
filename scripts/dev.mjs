#!/usr/bin/env node
// `npm run dev`: one command starts the backend (restarting on server/ and core/ changes) and the Vite frontend
// side by side, with each line of output tagged by the process it came from. When either exits, both stop.
import { spawn } from 'node:child_process'

const ANSI = { cyan: '36', magenta: '35', reset: '0' }
// How long children get to exit cleanly after SIGTERM before this script exits anyway.
const SHUTDOWN_GRACE_MS = 800
const EACH_NON_EMPTY_LINE = /^(?=.)/gm // zero-width match at the start of every non-empty line

const colored = (text, color) => `\x1b[${color}m${text}\x1b[${ANSI.reset}m`

const children = []
let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS)
}

const run = (name, args, color) => {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
  const tag = colored(`[${name}]`, color)
  const prefix = `${tag} `
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => process.stdout.write(chunk.toString().replace(EACH_NON_EMPTY_LINE, prefix)))
  child.on('exit', (code) => {
    console.log(`${prefix}exited (${code})`)
    shutdown()
  })
  return child
}

children.push(
  run('server', ['--watch-path=server', '--watch-path=core', 'server/main.ts'], ANSI.cyan),
  run('web', ['node_modules/vite/bin/vite.js'], ANSI.magenta),
)
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
