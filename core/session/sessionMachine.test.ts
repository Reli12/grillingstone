// Tests for the session state machine: which events move a session between statuses, and which are refused.
import { describe, expect, it } from 'vitest'

import { newSessionState, type SessionEvent, type SessionState, transition } from '#core/session/sessionMachine.ts'

/** Applies events in order and returns the final state; fails the test if any is refused. */
function after(...events: SessionEvent[]): SessionState {
  let state = newSessionState()
  for (const event of events) {
    const result = transition(state, event)
    if (!result.ok) throw new Error(`${event.type} refused: ${result.reason.message}`)
    state = result.state
  }
  return state
}

describe('session state machine', () => {
  it('starts in "starting" and is "thinking" once Claude has its first message', () => {
    expect(newSessionState().status).toBe('starting')
    expect(after({ type: 'started' }).status).toBe('thinking')
  })

  it("hands the turn to the human when Claude's turn ends", () => {
    expect(after({ type: 'started' }, { type: 'turnEnded' }).status).toBe('waiting')
  })

  it('lets the human speak only on their turn, which hands it back to Claude', () => {
    expect(after({ type: 'started' }, { type: 'turnEnded' }, { type: 'humanSaid' }).status).toBe('thinking')
    for (const notYourTurn of [newSessionState(), after({ type: 'started' })]) {
      expect(transition(notYourTurn, { type: 'humanSaid' })).toEqual({
        ok: false,
        reason: { code: 'still-replying', message: 'Claude is still replying — wait for its turn to finish.' },
      })
    }
  })

  it('moves to "writing" when the human confirms the write, and a second confirm changes nothing', () => {
    const writing = after({ type: 'started' }, { type: 'turnEnded' }, { type: 'writeConfirmed' })
    expect(writing).toMatchObject({ status: 'writing', writeConfirmed: true })
    expect(transition(writing, { type: 'writeConfirmed' })).toEqual({ ok: true, state: writing })
    expect(transition(after({ type: 'started' }), { type: 'writeConfirmed' })).toEqual({
      ok: false,
      reason: {
        code: 'still-replying',
        message: 'Claude is still replying — wait for its turn to finish, then press write.',
      },
    })
  })

  it('accepts a submission only after the human confirmed, and only once', () => {
    const unconfirmed = after({ type: 'started' })
    expect(transition(unconfirmed, { type: 'submissionAccepted' })).toEqual({
      ok: false,
      reason: {
        code: 'not-confirmed',
        message: 'The human has not confirmed yet. Run the Ready Check and wait for "Write it now.".',
      },
    })
    const accepted = after(
      { type: 'started' },
      { type: 'turnEnded' },
      { type: 'writeConfirmed' },
      { type: 'submissionAccepted' },
    )
    expect(accepted).toMatchObject({ status: 'writing', accepted: true })
    expect(transition(accepted, { type: 'submissionAccepted' })).toEqual({
      ok: false,
      reason: { code: 'already-submitted', message: 'This session already submitted successfully. Stop here.' },
    })
  })
  it("finishes the session when Claude's turn ends after an accepted submission", () => {
    const confirmed = [{ type: 'started' }, { type: 'turnEnded' }, { type: 'writeConfirmed' }] as const
    expect(after(...confirmed, { type: 'submissionAccepted' }, { type: 'turnEnded' }).status).toBe('finished')
    expect(after(...confirmed, { type: 'turnEnded' }).status).toBe('waiting')
  })
  it('ends as finished, stopped or failed when Claude Code exits, by what happened before', () => {
    const accepted = [
      { type: 'started' },
      { type: 'turnEnded' },
      { type: 'writeConfirmed' },
      { type: 'submissionAccepted' },
    ] as const
    expect(after(...accepted, { type: 'exited' }).status).toBe('finished')
    expect(after({ type: 'started' }, { type: 'stopRequested' }, { type: 'exited' }).status).toBe('stopped')
    expect(after({ type: 'started' }, { type: 'exited' }).status).toBe('failed')
    expect(after({ type: 'spawnFailed' }).status).toBe('failed')
  })

  it('keeps the status when a stop is requested, until Claude Code has exited', () => {
    expect(after({ type: 'started' }, { type: 'stopRequested' })).toMatchObject({ status: 'thinking', stopping: true })
  })
  it('never reopens an ended session', () => {
    const ended = [after({ type: 'started' }, { type: 'exited' }), after({ type: 'spawnFailed' })]
    const events: SessionEvent[] = [
      { type: 'started' },
      { type: 'turnEnded' },
      { type: 'humanSaid' },
      { type: 'exited' },
    ]
    for (const state of ended)
      for (const event of events)
        expect(transition(state, event)).toEqual({
          ok: false,
          reason: { code: 'session-ended', message: 'This session is no longer running.' },
        })
  })
  it('marks a session that was live when the backend restarted as interrupted', () => {
    for (const live of [
      newSessionState(),
      after({ type: 'started' }),
      after({ type: 'started' }, { type: 'turnEnded' }),
    ])
      expect(transition(live, { type: 'backendRestarted' })).toMatchObject({
        ok: true,
        state: { status: 'interrupted' },
      })
  })
})
