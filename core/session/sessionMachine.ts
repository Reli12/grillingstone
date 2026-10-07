// The session state machine: every status a Grilling or Template Session can be in, and the events that move it.
// Pure — the Supervisor feeds it events and does the I/O (saving, broadcasting, signalling Claude Code).
import { WRITE_NOW_MESSAGE } from '#core/session/cardProtocol.ts'
import { LIVE_STATUSES, type SessionStatus } from '#core/session/sessionTypes.ts'
import type { Reason } from '#core/shared/validation.ts'

export interface SessionState {
  status: SessionStatus
  /** The human confirmed the write ("Write it now"); only then may a Draft be submitted. */
  writeConfirmed: boolean
  /** The tool accepted the submitted Draft or Proposal; the session ends once Claude's turn does. */
  accepted: boolean
  /** The human asked to stop; the session ends as "stopped" once Claude Code has exited. */
  stopping: boolean
}

export type SessionEvent =
  | { type: 'started' }
  | { type: 'turnEnded' }
  | { type: 'humanSaid' }
  | { type: 'writeConfirmed' }
  | { type: 'submissionAccepted' }
  | { type: 'stopRequested' }
  /** Claude Code's process has exited and all its output has been handled. */
  | { type: 'exited' }
  | { type: 'spawnFailed' }
  /** The backend started again and found this session still marked live. */
  | { type: 'backendRestarted' }

export type Transition = { ok: true; state: SessionState } | { ok: false; reason: Reason }

const STILL_REPLYING: Reason = {
  code: 'still-replying',
  message: 'Claude is still replying — wait for its turn to finish.',
}

const STILL_REPLYING_ON_WRITE: Reason = {
  code: 'still-replying',
  message: 'Claude is still replying — wait for its turn to finish, then press write.',
}

const NOT_CONFIRMED: Reason = {
  code: 'not-confirmed',
  message: `The human has not confirmed yet. Run the Ready Check and wait for "${WRITE_NOW_MESSAGE}".`,
}

const ALREADY_SUBMITTED: Reason = {
  code: 'already-submitted',
  message: 'This session already submitted successfully. Stop here.',
}

const SESSION_ENDED: Reason = { code: 'session-ended', message: 'This session is no longer running.' }

const moveTo = (state: SessionState, status: SessionStatus): Transition => ({ ok: true, state: { ...state, status } })
const refuse = (reason: Reason): Transition => ({ ok: false, reason })

export const newSessionState = (): SessionState => ({
  status: 'starting',
  writeConfirmed: false,
  accepted: false,
  stopping: false,
})

/** How a session ends when Claude Code exits: what it achieved, else whether it was asked to stop, else a crash. */
function endStatus(state: SessionState): SessionStatus {
  if (state.accepted) return 'finished'
  if (state.stopping) return 'stopped'
  return 'failed'
}

export function transition(state: SessionState, event: SessionEvent): Transition {
  if (!LIVE_STATUSES.includes(state.status)) return refuse(SESSION_ENDED)
  switch (event.type) {
    case 'started':
      return moveTo(state, 'thinking')
    case 'turnEnded':
      return moveTo(state, state.accepted ? 'finished' : 'waiting')
    case 'humanSaid':
      return state.status === 'waiting' ? moveTo(state, 'thinking') : refuse(STILL_REPLYING)
    case 'writeConfirmed':
      if (state.status === 'writing') return { ok: true, state }
      if (state.status !== 'waiting') return refuse(STILL_REPLYING_ON_WRITE)
      return { ok: true, state: { ...state, status: 'writing', writeConfirmed: true } }
    case 'submissionAccepted':
      if (!state.writeConfirmed) return refuse(NOT_CONFIRMED)
      if (state.accepted) return refuse(ALREADY_SUBMITTED)
      return { ok: true, state: { ...state, accepted: true } }
    case 'stopRequested':
      return { ok: true, state: { ...state, stopping: true } }
    case 'exited':
      return moveTo(state, endStatus(state))
    case 'spawnFailed':
      return moveTo(state, 'failed')
    case 'backendRestarted':
      return moveTo(state, 'interrupted')
  }
}
