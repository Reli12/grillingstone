#!/usr/bin/env node
// One command for everything (PRD story 68): the backend and the Vite frontend, side by side.
import { spawn } from 'node:child_process'

const run = (name, args, color) => {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (d) => process.stdout.write(d.toString().replace(/^(?=.)/gm, prefix)))
  child.on('exit', (code) => {
    console.log(`${prefix}exited (${code})`)
    shutdown()
  })
  return child
}

const children = [
  run('server', ['--watch-path=server', '--watch-path=core', 'server/main.ts'], '36'),
  run('web', ['node_modules/vite/bin/vite.js'], '35'),
]
let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  for (const c of children) c.kill('SIGTERM')
  setTimeout(() => process.exit(0), 800)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
