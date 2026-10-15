// Session Supervisor (ADR-0001, ADR-0006, ADR-0010): the registry of running sessions. It starts one
// Assistant conversation per session, relays the human's turns, keeps the Transcript from the Assistant's
// steps, and accepts what a session writes only through the submit script. What each kind of session is — where it
// runs and what its submission means — comes from grillingSession.ts and templateSession.ts.
import { randomUUID } from 'node:crypto'

import { WRITE_NOW_MESSAGE } from '#core/session/cardProtocol.ts'
import { continuation } from '#core/session/continuation.ts'
import { newSessionState, type SessionEvent, type SessionState, transition } from '#core/session/sessionMachine.ts'
import {
  type ChatMessage,
  LIVE_STATUSES,
  type SessionStatus,
  type SessionSummary,
  type TemplateRequest,
  type TemplateSessionSummary,
} from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import type { Reason } from '#core/shared/validation.ts'

import { now } from '../services/clock.ts'
import { getDraft } from '../storage/drafts.ts'
import { allProjectIds } from '../storage/projects.ts'
import { getSettings } from '../storage/settings.ts'
import { getTemplate } from '../storage/templates.ts'
import {
  getTranscript,
  listTemplateTranscripts,
  listTranscripts,
  saveTemplateTranscript,
  saveTranscript,
} from '../storage/transcripts.ts'
import type { Assistant, AssistantExit, AssistantSession } from './assistant.ts'
import { systemMessage } from './chatMessages.ts'
import { claudeAssistant } from './claudeAssistant.ts'
import { type GrillingDeps, prepareGrillingSession, type StartArgs } from './grillingSession.ts'
import { SessionError } from './sessionError.ts'
import { type AnyTranscript, type PreparedSession, type Scope, type SubmitResult, summaryOf } from './sessionScope.ts'
import type { StreamStep } from './streamEvents.ts'
import { prepareTemplateSession, type TemplateSessionDeps } from './templateSession.ts'

interface Live {
  transcript: AnyTranscript
  scope: Scope
  session: AssistantSession
  token: string
  /** Status, plus whether a submission was accepted or a stop requested: owned by the session state machine. */
  state: SessionState
  /** Stream events are handled one at a time, in order. */
  queue: Promise<void>
  /** Settles once the session has ended and its Transcript is saved. */
  ended: Promise<void>
  markEnded: () => void
}

const ALREADY_RUNNING_ON_DRAFT = 'A session is already running on this Draft — finish or stop it first.'
const INTERRUPTED_BY_RESTART =
  'The backend restarted while this session ran, so it ended. Continue it, or start a new session from what is saved.'

/** Stands in until the session's Assistant is started, right after its Live exists for the Assistant to report to. */
const NOT_STARTED: AssistantSession = { send: () => {}, close: () => {}, stop: () => {} }

/** A new session's in-memory state; `markEnded` settles `ended` once its Transcript is saved. */
function newLive(transcript: AnyTranscript, scope: Scope, token: string): Live {
  let markEnded = () => {}
  const ended = new Promise<void>((resolve) => (markEnded = resolve))
  return {
    transcript,
    scope,
    session: NOT_STARTED,
    token,
    state: newSessionState(),
    queue: Promise.resolve(),
    ended,
    markEnded,
  }
}

/** Asks the session's Assistant to end; it reports the exit like any other. */
function requestStop(live: Live) {
  const next = transition(live.state, { type: 'stopRequested' })
  if (next.ok) live.state = next.state
  live.session.stop()
}

const humanMessage = (kind: 'answer' | 'message' | 'write', text: string): ChatMessage => ({
  id: newId('m'),
  at: now(),
  role: 'human',
  kind,
  text,
})

/** Marks a Transcript that was still running when the backend went down as interrupted, and saves it. */
async function markInterruptedIfLive<T extends AnyTranscript>(transcript: T, save: (transcript: T) => Promise<void>) {
  const next = transition({ ...newSessionState(), status: transcript.status }, { type: 'backendRestarted' })
  if (!next.ok) return
  Object.assign(transcript, { status: next.state.status, endedAt: now() })
  transcript.messages.push(systemMessage(INTERRUPTED_BY_RESTART, 'error'))
  await save(transcript)
}

/** What the human asks for when starting a Grilling Session; the Supervisor adds the Assistant. */
export type SessionRequest = Omit<StartArgs, 'assistant'>

export class Supervisor {
  private live = new Map<string, Live>()
  /** `ended` promises of sessions whose Transcript is not saved yet — they may already be out of `live`. */
  private unsaved = new Set<Promise<void>>()
  private deps: GrillingDeps & TemplateSessionDeps
  /** The Assistant every new session runs on. */
  private assistant: Assistant

  constructor(deps: GrillingDeps & TemplateSessionDeps, assistant: Assistant = claudeAssistant) {
    this.deps = deps
    this.assistant = assistant
  }

  /** Sessions cannot survive a backend restart; mark the ones that were running. */
  async markInterrupted() {
    for (const projectId of await allProjectIds())
      for (const transcript of await listTranscripts(projectId)) await markInterruptedIfLive(transcript, saveTranscript)
    for (const transcript of await listTemplateTranscripts())
      await markInterruptedIfLive(transcript, saveTemplateTranscript)
  }

  liveForDraft(draftId: string): SessionSummary | undefined {
    for (const { transcript } of this.live.values())
      if (transcript.kind !== 'template' && transcript.draftId === draftId) return summaryOf(transcript)
    return undefined
  }

  liveTemplateSession(): TemplateSessionSummary | undefined {
    for (const { transcript } of this.live.values()) if (transcript.kind === 'template') return summaryOf(transcript)
    return undefined
  }

  /** Stops every running session; resolves once each one, including any already ending, has saved its Transcript. */
  async stopAll() {
    for (const live of this.live.values()) requestStop(live)
    await Promise.all(this.unsaved)
  }

  // ── Starting ────────────────────────────────────────────────────────────

  async start(request: SessionRequest): Promise<SessionSummary> {
    if (this.liveForDraft(request.draftId)) throw new SessionError(ALREADY_RUNNING_ON_DRAFT)
    const args = { ...request, assistant: this.assistant }
    return summaryOf(await this.launch(await prepareGrillingSession(args, this.deps)))
  }

  /** A Continuation (ADR-0014): a new session that resumes an ended one's conversation. */
  async continue(projectId: string, draftId: string, sessionId: string, humanNote?: string): Promise<SessionSummary> {
    const earlier = await getTranscript(projectId, sessionId)
    if (earlier.draftId !== draftId) throw new SessionError('This session belongs to another Draft.')
    if (this.liveForDraft(draftId)) throw new SessionError(ALREADY_RUNNING_ON_DRAFT)
    const draft = await getDraft(projectId, draftId)
    // A deleted Template has no latest version; continuation() then decides without one.
    const latest = await getTemplate(draft.template.id).catch(() => undefined)
    const next = continuation(summaryOf(earlier), draft, latest?.version)
    if (!next.ok) throw new SessionError(next.reason)
    return this.start({
      projectId,
      draftId,
      kind: next.kind,
      focus: next.focus,
      humanNote,
      continues: summaryOf(earlier),
    })
  }

  async startTemplate(request: TemplateRequest): Promise<TemplateSessionSummary> {
    if (this.liveTemplateSession())
      throw new SessionError('A Template Session is already running — continue or stop it first.')
    return summaryOf(await this.launch(await prepareTemplateSession(request, this.assistant, this.deps)))
  }

  private async launch<T extends AnyTranscript>({
    transcript,
    scope,
    seed,
    intro,
    resume,
  }: PreparedSession<T>): Promise<T> {
    const token = randomUUID()
    const conversation = { persist: scope.persist, ...(resume ? { resume } : {}) }
    const model = (await getSettings()).model
    const submit = (payload: unknown) => this.submit(transcript.id, token, payload)
    const launch = { sessionId: transcript.id, token, scope, seed, model, conversation, submit }
    const live = newLive(transcript, scope, token)
    live.session = this.assistant.start(launch, {
      onStep: (step) => this.queueStep(live, step),
      onExit: (exit) => this.onExit(live, exit),
    })
    this.live.set(transcript.id, live)
    this.unsaved.add(live.ended)
    void live.ended.then(() => this.unsaved.delete(live.ended))

    await this.push(live, systemMessage(intro))
    if (transcript.humanNote) await this.push(live, humanMessage('message', transcript.humanNote))
    live.session.send(seed.firstMessage)
    // The Assistant may already have failed to start; that session has ended and stays ended.
    if (this.live.has(transcript.id)) await this.moveOn(live, { type: 'started' })
    return transcript
  }

  /** Steps are handled one at a time, in order; a failed one is logged so it does not stall the session. */
  private queueStep(live: Live, step: StreamStep) {
    live.queue = live.queue
      .then(() => this.onStep(live, step))
      .catch((error) => console.error('[supervisor] step handling failed', error))
  }

  // ── Human input ─────────────────────────────────────────────────────────

  private get(sessionId: string): Live {
    const live = this.live.get(sessionId)
    if (!live) throw new SessionError('This session is no longer running.')
    return live
  }

  async say(sessionId: string, text: string, kind: 'answer' | 'message') {
    const live = this.get(sessionId)
    const said = text.trim()
    if (!said) throw new SessionError('Say something first.')
    this.advance(live, { type: 'humanSaid' })
    await this.push(live, humanMessage(kind, said))
    live.session.send(said)
    await this.setStatus(live, live.state.status)
  }

  /** The human confirms the Ready Check, or says "enough — write it" at any moment. */
  async writeNow(sessionId: string) {
    const live = this.get(sessionId)
    const before = live.state
    this.advance(live, { type: 'writeConfirmed' })
    if (live.state === before) return // already writing: a second press changes nothing
    await this.push(live, humanMessage('write', WRITE_NOW_MESSAGE))
    live.session.send(WRITE_NOW_MESSAGE)
    await this.setStatus(live, live.state.status)
  }

  stop(sessionId: string) {
    requestStop(this.get(sessionId))
  }

  // ── The Assistant's steps ───────────────────────────────────────────────

  private async onStep(live: Live, step: StreamStep) {
    switch (step.type) {
      case 'message':
        await this.push(live, step.message)
        return
      case 'conversation':
        if (live.transcript.conversationId === step.id) return
        live.transcript.conversationId = step.id
        await live.scope.save(live.transcript)
        return
      case 'toolResult':
        await this.updateTool(live, step.messageId, step.outcome)
        if (step.glossaryEdited) live.scope.onGlossaryEdit?.()
        return
      case 'turnEnded':
        await this.onTurnEnded(live)
    }
  }

  /** After an accepted submission the session is done; otherwise it is the human's turn. */
  private async onTurnEnded(live: Live) {
    if (live.state.accepted) live.session.close()
    await this.moveOn(live, { type: 'turnEnded' })
  }

  // ── Submissions (from scripts/writeDraft.mjs) ───────────────────────────

  async submit(sessionId: string, token: string, payload: unknown): Promise<SubmitResult> {
    const live = this.live.get(sessionId)
    if (!live || live.token !== token)
      return { ok: false, reasons: [{ code: 'unknown-session', message: 'This session is not running.' }] }
    const refuse = async (reasons: Reason[]) => {
      const listed = reasons.map((reason) => reason.message).join(' · ')
      await this.push(live, systemMessage(`Submission refused — ${listed}`, 'error'))
      return { ok: false as const, reasons }
    }
    // Checked before the submission is stored; committed only once it has been.
    const allowed = transition(live.state, { type: 'submissionAccepted' })
    if (!allowed.ok) return refuse([allowed.reason])

    const result = await live.scope.submit(payload)
    if (!result.ok) return refuse(result.reasons)
    const accepted = transition(live.state, { type: 'submissionAccepted' })
    if (accepted.ok) live.state = accepted.state
    await this.push(live, systemMessage(result.message, 'success'))
    return result
  }

  // ── Transcript bookkeeping ──────────────────────────────────────────────

  private async push(live: Live, message: ChatMessage) {
    live.transcript.messages.push(message)
    await live.scope.save(live.transcript)
    live.scope.emitMessage(live.transcript, message)
  }

  private async updateTool(live: Live, messageId: string, outcome: 'ok' | 'denied' | 'error') {
    const message = live.transcript.messages.find((candidate) => candidate.id === messageId)
    if (!message || message.role !== 'tool') return
    message.outcome = outcome
    await live.scope.save(live.transcript)
    live.scope.emitMessage(live.transcript, message)
  }

  /** Feeds an event to the session's state machine; a refusal becomes the SessionError the human sees. */
  private advance(live: Live, event: SessionEvent): SessionState {
    const next = transition(live.state, event)
    if (!next.ok) throw new SessionError(next.reason.message)
    live.state = next.state
    live.transcript.writeConfirmed = next.state.writeConfirmed
    return next.state
  }

  /** Advances the session and records the result: a new live status is saved, an ended one ends the session. */
  private async moveOn(live: Live, event: SessionEvent) {
    const { status } = this.advance(live, event)
    if (LIVE_STATUSES.includes(status)) await this.setStatus(live, status)
    else await this.end(live, status)
  }

  private async setStatus(live: Live, status: SessionStatus) {
    if (live.transcript.status === status) return
    live.transcript.status = status
    await live.scope.save(live.transcript)
    live.scope.emitSession(live.transcript)
  }

  private onExit(live: Live, exit: AssistantExit) {
    if (exit.type === 'spawnFailed') {
      if (!this.live.has(live.transcript.id)) return
      this.advance(live, { type: 'spawnFailed' })
      void this.end(live, 'failed', exit.error)
      return
    }
    void this.onExited(live, exit.error)
  }

  /** Once every step is handled: a session that had not finished ended by crashing. */
  private async onExited(live: Live, error: string) {
    await live.queue
    if (!this.live.has(live.transcript.id)) return
    const { status } = this.advance(live, { type: 'exited' })
    await this.end(live, status, status === 'failed' ? error : undefined)
  }

  private async end(live: Live, status: SessionStatus, error?: string) {
    if (!this.live.has(live.transcript.id)) return
    try {
      await this.saveEnd(live, status, error)
    } finally {
      live.markEnded()
    }
  }

  private async saveEnd(live: Live, status: SessionStatus, error?: string) {
    // Out of `live` first, so an exit racing a stop cannot end the session twice.
    this.live.delete(live.transcript.id)
    live.session.stop()
    const transcript = live.transcript
    transcript.endedAt = now()
    let last: ChatMessage | undefined
    if (error) {
      transcript.error = error
      last = systemMessage(error, 'error')
    } else if (status === 'stopped') {
      last = systemMessage('Session stopped. Nothing was written.')
    }
    if (last) transcript.messages.push(last)
    transcript.status = status
    await live.scope.save(transcript)
    if (last) live.scope.emitMessage(transcript, last)
    live.scope.emitSession(transcript)
  }
}
