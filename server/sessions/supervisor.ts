// Session Supervisor (ADR-0001, ADR-0006, ADR-0010): the registry of running sessions. It launches one
// headless `claude -p` per session, relays the human's turns, keeps the Transcript from Claude's output, and
// accepts what a session writes only through the submit script. What each kind of session is — where it
// runs and what its submission means — comes from grillingSession.ts and templateSession.ts.
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'

import { type PrototypeSession, prototypeSummaryOf } from '#core/prototype/prototypeRecords.ts'
import { SUBMISSION_REFUSED_PREFIX } from '#core/prototype/prototypeStep.ts'
import { WRITE_NOW_MESSAGE } from '#core/session/cardProtocol.ts'
import { continuation } from '#core/session/continuation.ts'
import { buildMessageContent, type ImageRef, type ImageUpload, type NumberedImage } from '#core/session/images.ts'
import { newSessionState, type SessionEvent, type SessionState, transition } from '#core/session/sessionMachine.ts'
import {
  type ChatMessage,
  LIVE_STATUSES,
  type PrototypeSessionSummary,
  type SessionStatus,
  type SessionSummary,
  type TemplateRequest,
  type TemplateSessionSummary,
  type Transcript,
} from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import type { Reason } from '#core/shared/validation.ts'

import { CLAUDE_BIN } from '../config.ts'
import { now } from '../services/clock.ts'
import { getDraft } from '../storage/drafts.ts'
import { prototypeWorkDir } from '../storage/paths.ts'
import { allProjectIds } from '../storage/projects.ts'
import { listPrototypeSessions, savePrototypeSession } from '../storage/prototypes.ts'
import { getSettings } from '../storage/settings.ts'
import { getTemplate } from '../storage/templates.ts'
import {
  getTranscript,
  listTemplateTranscripts,
  listTranscripts,
  saveTemplateTranscript,
  saveTranscript,
} from '../storage/transcripts.ts'
import { jsonLines, sendMessage, spawnClaude } from './claudeProcess.ts'
import { type GrillingDeps, prepareGrillingSession, type StartArgs } from './grillingSession.ts'
import { preparePrototypeSession, type PrototypeSessionDeps, type PrototypeStartArgs } from './prototypeSession.ts'
import { SessionError } from './sessionError.ts'
import { discardSessionImages, numberUploads, recordLastImage, saveNumbered } from './sessionImages.ts'
import {
  type AnyTranscript,
  isGrillingTranscript,
  isPrototypeSession,
  type PreparedSession,
  type Scope,
  type SubmitResult,
  summaryOf,
} from './sessionScope.ts'
import { type KnownTool, readStreamEvent, type StreamStep } from './streamEvents.ts'
import { prepareTemplateSession, type TemplateSessionDeps } from './templateSession.ts'

interface Live {
  transcript: AnyTranscript
  scope: Scope
  child: ChildProcess
  token: string
  stderrTail: string
  /** tool_use id → the tool message showing it. */
  tools: Map<string, KnownTool>
  /** Status, plus whether a submission was accepted or a stop requested: owned by the session state machine. */
  state: SessionState
  /** Stream events are handled one at a time, in order. */
  queue: Promise<void>
  /** Settles once the session has ended and its Transcript is saved. */
  ended: Promise<void>
  markEnded: () => void
}

/** How much of Claude Code's stderr is kept, so a crash can be explained without holding all of it. */
const STDERR_TAIL_CHARS = 4000
/** How many of the last stderr lines go into a crashed session's error. */
const STDERR_LINES_IN_ERROR = 5
/** How long a stopped session gets to exit on SIGTERM before it is killed. */
const STOP_GRACE_MS = 3000

const ALREADY_RUNNING_ON_DRAFT = 'A session is already running on this Draft — finish or stop it first.'
const ALREADY_WRITING_PROTOTYPE = 'A Prototype is already being written for this Draft.'
const NO_MESSAGES_TO_PROTOTYPE = 'A Prototype Session takes no messages: it works from what it was started with.'
const PROTOTYPE_NOT_SUBMITTED = 'Claude ended its turn without submitting a Prototype.'
const INTERRUPTED_BY_RESTART =
  'The backend restarted while this session ran, so it ended. Continue it, or start a new session from what is saved.'
const PROTOTYPE_INTERRUPTED_BY_RESTART = 'The backend restarted while this Prototype was being written'

/** A per-Draft, per-kind key for the "being started" reservations. */
const startingKey = (kind: 'grilling' | 'prototype', draftId: string) => `${kind}:${draftId}`

/** A just-spawned session's in-memory state; `markEnded` settles `ended` once its Transcript is saved. */
function newLive(transcript: AnyTranscript, scope: Scope, child: ChildProcess, token: string): Live {
  let markEnded = () => {}
  const ended = new Promise<void>((resolve) => (markEnded = resolve))
  return {
    transcript,
    scope,
    child,
    token,
    stderrTail: '',
    tools: new Map(),
    // A single-turn session has nobody to confirm a write, so its submission is allowed from the start.
    state: scope.singleTurn ? { ...newSessionState(), writeConfirmed: true } : newSessionState(),
    queue: Promise.resolve(),
    ended,
    markEnded,
  }
}

/** Asks the session's Claude Code to exit, and kills it if it is still running after the grace period. */
function requestStop(live: Live) {
  const next = transition(live.state, { type: 'stopRequested' })
  if (next.ok) live.state = next.state
  live.child.kill('SIGTERM')
  const killIfStillRunning = () => live.child.exitCode === null && live.child.kill('SIGKILL')
  setTimeout(killIfStillRunning, STOP_GRACE_MS).unref()
}

const systemMessage = (text: string, tone?: 'success' | 'error'): ChatMessage => ({
  id: newId('m'),
  at: now(),
  role: 'system',
  ...(tone ? { tone } : {}),
  text,
})

const humanMessage = (kind: 'answer' | 'message' | 'write', text: string, images: ImageRef[] = []): ChatMessage => ({
  id: newId('m'),
  at: now(),
  role: 'human',
  kind,
  text,
  ...(images.length ? { images } : {}),
})

/** What the human said: words, Images, or both. */
export interface Said {
  text: string
  kind: 'answer' | 'message'
  images?: ImageUpload[]
}

/** A Prototype Session left running when the backend went down is Failed, and its working folder is removed. */
async function markPrototypeInterrupted(session: PrototypeSession) {
  if (!LIVE_STATUSES.includes(session.status)) return
  Object.assign(session, { status: 'failed', endedAt: now(), error: PROTOTYPE_INTERRUPTED_BY_RESTART })
  session.messages.push(systemMessage(PROTOTYPE_INTERRUPTED_BY_RESTART, 'error'))
  await fs.rm(prototypeWorkDir(session.id), { recursive: true, force: true })
  await savePrototypeSession(session)
}

/** Marks a Transcript that was still running when the backend went down as interrupted, and saves it. */
async function markInterruptedIfLive<T extends AnyTranscript>(transcript: T, save: (transcript: T) => Promise<void>) {
  const next = transition({ ...newSessionState(), status: transcript.status }, { type: 'backendRestarted' })
  if (!next.ok) return
  Object.assign(transcript, { status: next.state.status, endedAt: now() })
  transcript.messages.push(systemMessage(INTERRUPTED_BY_RESTART, 'error'))
  await save(transcript)
}

/** The error a session that exited on its own ends with: how it exited, then the end of its stderr. */
function crashError(stderrTail: string, code: number | null, signal: NodeJS.Signals | null) {
  const tail = stderrTail.trim().split('\n').slice(-STDERR_LINES_IN_ERROR).join('\n')
  const how = signal ?? `code ${code}`
  const detail = tail ? `: ${tail}` : '.'
  return `Claude Code exited (${how})${detail}`
}

export class Supervisor {
  private live = new Map<string, Live>()
  /** Drafts a session is being started on: reserved before anything is awaited, so two starts cannot both pass. */
  private starting = new Set<string>()
  /** `ended` promises of sessions whose Transcript is not saved yet — they may already be out of `live`. */
  private unsaved = new Set<Promise<void>>()
  private deps: GrillingDeps & TemplateSessionDeps & PrototypeSessionDeps

  constructor(deps: GrillingDeps & TemplateSessionDeps & PrototypeSessionDeps) {
    this.deps = deps
  }

  /** Sessions cannot survive a backend restart; mark the ones that were running. */
  async markInterrupted() {
    for (const projectId of await allProjectIds()) {
      for (const transcript of await listTranscripts(projectId)) await markInterruptedIfLive(transcript, saveTranscript)
      for (const session of await listPrototypeSessions(projectId)) await markPrototypeInterrupted(session)
    }
    for (const transcript of await listTemplateTranscripts())
      await markInterruptedIfLive(transcript, saveTemplateTranscript)
  }

  /** The live Grilling Session on the Draft — what the chat shows. A Prototype Session is looked up separately. */
  liveForDraft(draftId: string): SessionSummary | undefined {
    for (const { transcript } of this.live.values())
      if (isGrillingTranscript(transcript) && transcript.draftId === draftId) return summaryOf(transcript)
    return undefined
  }

  /** The live Prototype Session on the Draft, if one is being written. */
  livePrototypeForDraft(draftId: string): PrototypeSessionSummary | undefined {
    for (const { transcript } of this.live.values())
      if (isPrototypeSession(transcript) && transcript.draftId === draftId) return prototypeSummaryOf(transcript)
    return undefined
  }

  /** A running Grilling Session's Transcript, as it is in memory; undefined once it has ended. */
  liveTranscript(sessionId: string): Transcript | undefined {
    const transcript = this.live.get(sessionId)?.transcript
    return transcript && isGrillingTranscript(transcript) ? transcript : undefined
  }

  /** Whether a session of either kind runs on the Draft or is being started on it; deleting the Draft waits. */
  hasSessionOn(draftId: string): boolean {
    return (
      this.liveForDraft(draftId) !== undefined ||
      this.livePrototypeForDraft(draftId) !== undefined ||
      this.starting.has(startingKey('grilling', draftId)) ||
      this.starting.has(startingKey('prototype', draftId))
    )
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

  async start(args: StartArgs): Promise<SessionSummary> {
    const key = startingKey('grilling', args.draftId)
    if (this.liveForDraft(args.draftId) || this.starting.has(key)) throw new SessionError(ALREADY_RUNNING_ON_DRAFT)
    this.starting.add(key)
    try {
      return summaryOf(await this.launch(await prepareGrillingSession(args, this.deps)))
    } finally {
      // Once launched the session is in `live`, which holds the Draft from here on.
      this.starting.delete(key)
    }
  }

  /** A Prototype Session: one per Draft at a time, beside any Grilling Session on it. */
  async startPrototype(args: PrototypeStartArgs): Promise<PrototypeSessionSummary> {
    const key = startingKey('prototype', args.draftId)
    if (this.livePrototypeForDraft(args.draftId) || this.starting.has(key))
      throw new SessionError(ALREADY_WRITING_PROTOTYPE)
    this.starting.add(key)
    try {
      return prototypeSummaryOf(await this.launch(await preparePrototypeSession(args, this.deps)))
    } finally {
      this.starting.delete(key)
    }
  }

  /** Stops a running Prototype Session of the Project. */
  stopPrototype(projectId: string, sessionId: string) {
    const live = this.get(sessionId)
    if (!isPrototypeSession(live.transcript) || live.transcript.projectId !== projectId)
      throw new SessionError('This session is no longer running.')
    requestStop(live)
  }

  /** A Continuation (ADR-0014): a new session that resumes an ended one's Claude Code conversation. */
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
    return summaryOf(await this.launch(await prepareTemplateSession(request, this.deps)))
  }

  private async launch<T extends AnyTranscript>({
    transcript,
    scope,
    seed,
    intro,
    resume,
    images = [],
    numberedImages,
    abandon,
  }: PreparedSession<T>): Promise<T> {
    // Saved before Claude Code starts, so a refused or unsaveable Image starts no session; if anything before the
    // start fails, the Images already written are removed again. A scope that kept its Images brings them numbered.
    let numbered: NumberedImage[]
    let refs: ImageRef[]
    let model: string
    try {
      if (numberedImages) {
        numbered = numberedImages
        refs = []
      } else {
        const uploads = numberUploads(transcript, images)
        refs = await saveNumbered(transcript, uploads)
        numbered = uploads
      }
      model = (await getSettings()).model
    } catch (error) {
      await discardSessionImages(transcript)
      await abandon?.()
      throw error
    }
    recordLastImage(transcript, refs)
    const token = randomUUID()
    const conversation = { persist: scope.persist, ...(resume ? { resume } : {}) }
    const child = spawnClaude({ sessionId: transcript.id, token, scope, seed, model, conversation })
    const live = newLive(transcript, scope, child, token)
    this.live.set(transcript.id, live)
    this.unsaved.add(live.ended)
    void live.ended.then(() => this.unsaved.delete(live.ended))
    this.watch(live)

    await this.push(live, systemMessage(intro))
    const note = 'humanNote' in transcript ? transcript.humanNote : undefined
    if (note || refs.length) await this.push(live, humanMessage('message', note ?? '', refs))
    sendMessage(child, buildMessageContent(seed.firstMessage, numbered))
    // Claude Code may already have failed to start; that session has ended and stays ended.
    if (this.live.has(transcript.id)) await this.moveOn(live, { type: 'started' })
    return transcript
  }

  /** Follows the child process: its stream events, its stderr, and how it ends. */
  private watch(live: Live) {
    const { child } = live
    child.stdout!.setEncoding('utf8')
    child.stdout!.on(
      'data',
      jsonLines((event) => {
        // A failed event is logged and the queue carries on, so one bad event does not stall the session.
        live.queue = live.queue
          .then(() => this.onEvent(live, event))
          .catch((error) => console.error('[supervisor] event handling failed', error))
      }),
    )
    child.stderr!.setEncoding('utf8')
    child.stderr!.on('data', (chunk: string) => {
      live.stderrTail = (live.stderrTail + chunk).slice(-STDERR_TAIL_CHARS)
    })
    child.on('error', (error) => {
      if (!this.live.has(live.transcript.id)) return
      this.advance(live, { type: 'spawnFailed' })
      void this.end(live, 'failed', `Could not start Claude Code (${CLAUDE_BIN}): ${error.message}`)
    })
    // 'close', not 'exit': it fires only after stdout is fully read, so no stream event lands after the session ended.
    child.on('close', (code, signal) => void this.onExit(live, code, signal))
  }

  // ── Human input ─────────────────────────────────────────────────────────

  private get(sessionId: string): Live {
    const live = this.live.get(sessionId)
    if (!live) throw new SessionError('This session is no longer running.')
    return live
  }

  /** A single-turn session works from what it was started with; nothing the human says reaches it. */
  private getTalkative(sessionId: string): Live {
    const live = this.get(sessionId)
    if (live.scope.singleTurn) throw new SessionError(NO_MESSAGES_TO_PROTOTYPE)
    return live
  }

  async say(sessionId: string, { text, kind, images = [] }: Said) {
    const live = this.getTalkative(sessionId)
    const said = text.trim()
    if (!said && !images.length) throw new SessionError('Say something first.')
    const numbered = numberUploads(live.transcript, images)
    const turnBefore = { state: live.state, writeConfirmed: live.transcript.writeConfirmed }
    // Advancing first takes the turn before anything is awaited: a second message sent meanwhile is refused,
    // so two messages never get the same Image numbers.
    this.advance(live, { type: 'humanSaid' })
    let refs: ImageRef[]
    try {
      refs = await saveNumbered(live.transcript, numbered)
      if (!this.live.has(live.transcript.id)) throw new SessionError('This session is no longer running.')
    } catch (error) {
      // The message was not sent, so the turn is still the human's (unless the session ended meanwhile).
      if (this.live.has(live.transcript.id)) {
        live.state = turnBefore.state
        live.transcript.writeConfirmed = turnBefore.writeConfirmed
      }
      throw error
    }
    // The last number is recorded in the same step as the message that lists the Images.
    recordLastImage(live.transcript, refs)
    await this.push(live, humanMessage(kind, said, refs))
    sendMessage(live.child, buildMessageContent(said, numbered))
    await this.setStatus(live, live.state.status)
  }

  /** The human confirms the Ready Check, or says "enough — write it" at any moment. */
  async writeNow(sessionId: string) {
    const live = this.getTalkative(sessionId)
    const before = live.state
    this.advance(live, { type: 'writeConfirmed' })
    if (live.state === before) return // already writing: a second press changes nothing
    await this.push(live, humanMessage('write', WRITE_NOW_MESSAGE))
    sendMessage(live.child, WRITE_NOW_MESSAGE)
    await this.setStatus(live, live.state.status)
  }

  stop(sessionId: string) {
    requestStop(this.get(sessionId))
  }

  // ── Claude's output ─────────────────────────────────────────────────────

  private async onEvent(live: Live, event: Record<string, unknown>) {
    const context = { cwd: live.scope.cwd, submitLabel: live.scope.submitLabel, tools: live.tools }
    for (const step of readStreamEvent(event, context)) await this.onStep(live, step)
  }

  private async onStep(live: Live, step: StreamStep) {
    switch (step.type) {
      case 'message':
        if (step.toolUseId && step.tool) live.tools.set(step.toolUseId, step.tool)
        await this.push(live, step.message)
        return
      case 'claudeSession':
        if (live.transcript.claudeSessionId === step.id) return
        live.transcript.claudeSessionId = step.id
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
    if (live.state.accepted) live.child.stdin?.end()
    if (live.scope.singleTurn && !live.state.accepted) await this.endUnsubmitted(live)
    else await this.moveOn(live, { type: 'turnEnded' })
  }

  /** A single-turn session whose turn ended with nothing accepted has no next turn: it ends as stopped or Failed. */
  private async endUnsubmitted(live: Live) {
    const { status } = this.advance(live, { type: 'exited' })
    await this.end(live, status, status === 'failed' ? PROTOTYPE_NOT_SUBMITTED : undefined)
  }

  // ── Submissions (from scripts/writeDraft.mjs) ───────────────────────────

  async submit(sessionId: string, token: string, payload: unknown): Promise<SubmitResult> {
    const notRunning: SubmitResult = {
      ok: false,
      reasons: [{ code: 'unknown-session', message: 'This session is not running.' }],
    }
    const live = this.live.get(sessionId)
    if (!live || live.token !== token) return notRunning
    // Still this session, running? A Stop during an await below ends it, and an ended record is never written to.
    const isRunning = () => this.live.get(sessionId) === live
    // Claude's stream events are handled one after another; the one announcing this very command may still be in the
    // queue, and must be recorded before the outcome of the submission, or a refusal would come before its command.
    await live.queue
    if (!isRunning()) return notRunning
    const refuse = async (reasons: Reason[]) => {
      const listed = reasons.map((reason) => reason.message).join(' · ')
      await this.push(live, systemMessage(`${SUBMISSION_REFUSED_PREFIX} — ${listed}`, 'error'))
      return { ok: false as const, reasons }
    }
    // Checked before the submission is stored; committed only once it has been.
    const allowed = transition(live.state, { type: 'submissionAccepted' })
    if (!allowed.ok) return refuse([allowed.reason])

    const result = await live.scope.submit(payload)
    if (!isRunning()) return notRunning
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

  private async onExit(live: Live, code: number | null, signal: NodeJS.Signals | null) {
    await live.queue
    if (!this.live.has(live.transcript.id)) return
    const { status } = this.advance(live, { type: 'exited' })
    await this.end(live, status, status === 'failed' ? crashError(live.stderrTail, code, signal) : undefined)
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
    if (live.child.exitCode === null) live.child.kill('SIGTERM')
    // Released before the final save, so a session seen as ended has its working folder gone.
    await live.scope.release?.()
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
