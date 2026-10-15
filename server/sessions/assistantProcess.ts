// What both Assistant adapters do with their process: keep the end of its stderr so a crash can be explained,
// report how it ended, and stop it (SIGTERM, then SIGKILL after a grace period).
import type { ChildProcess } from 'node:child_process'

import type { AssistantEvents } from './assistant.ts'

/** How much of an Assistant's stderr is kept, so a crash can be explained without holding all of it. */
const STDERR_TAIL_CHARS = 4000
/** How many of the last stderr lines go into a crashed session's error. */
const STDERR_LINES_IN_ERROR = 5
/** How long a stopped or closed session gets to exit before it is killed. */
export const STOP_GRACE_MS = 3000

interface ExitOptions {
  /** The Assistant's name in error text ("Claude Code", "Codex"). */
  label: string
  bin: string
  events: AssistantEvents
  /** Runs once the process is gone, before the exit is reported. */
  onGone?: () => void
}

/** How the Assistant exited, then the end of its stderr. */
function exitError(label: string, stderrTail: string, code: number | null, signal: NodeJS.Signals | null) {
  const tail = stderrTail.trim().split('\n').slice(-STDERR_LINES_IN_ERROR).join('\n')
  const how = signal ?? `code ${code}`
  const detail = tail ? `: ${tail}` : '.'
  return `${label} exited (${how})${detail}`
}

/**
 * Reports the process's end to the Supervisor: a spawn failure, or its exit with the end of its stderr.
 * Returns a way to add a reason the Assistant gave elsewhere (over its protocol) to that error.
 */
export function followExit(child: ChildProcess, { label, bin, events, onGone = () => {} }: ExitOptions) {
  let stderrTail = ''
  child.stderr!.setEncoding('utf8')
  child.stderr!.on('data', (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL_CHARS)
  })
  child.on('error', (error) => {
    onGone()
    events.onExit({ type: 'spawnFailed', error: `Could not start ${label} (${bin}): ${error.message}` })
  })
  // 'close', not 'exit': it fires only after stdout is fully read, so no step lands after the exit.
  child.on('close', (code, signal) => {
    onGone()
    events.onExit({ type: 'exited', error: exitError(label, stderrTail, code, signal) })
  })
  return (reason: string) => (stderrTail = `${stderrTail}\n${reason}`)
}

/** Whether the process still runs, and a stop that asks it to end and kills it after the grace period. */
export function stopper(child: ChildProcess) {
  const running = () => child.exitCode === null && child.signalCode === null
  const stop = () => {
    if (!running()) return
    child.kill('SIGTERM')
    const killIfStillRunning = () => running() && child.kill('SIGKILL')
    setTimeout(killIfStillRunning, STOP_GRACE_MS).unref()
  }
  return { running, stop }
}
