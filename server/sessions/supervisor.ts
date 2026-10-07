// Session Supervisor (ADR-0001, ADR-0006, ADR-0010): the registry of running sessions. It launches one
// headless `claude -p` per session, relays the human's turns, keeps the Transcript from Claude's output, and
// accepts what a session writes only through the submit script. What each kind of session is — where it
// runs and what its submission means — comes from grillingSession.ts and templateSession.ts.
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { WRITE_NOW_MESSAGE } from '#core/session/cardProtocol.ts'
import { continuation } from '#core/session/continuation.ts'
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

import { CLAUDE_BIN } from '../config.ts'
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
import { jsonLines, sendMessage, spawnClaude } from './claudeProcess.ts'
import { type GrillingDeps, prepareGrillingSession, type StartArgs } from './grillingSession.ts'
import { SessionError } from './sessionError.ts'
import { type AnyTranscript, type PreparedSession, type Scope, type SubmitResult, summaryOf } from './sessionScope.ts'
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
  accepted: boolean
  stopping: boolean
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
const INTERRUPTED_BY_RESTART =
  'The backend restarted while this session ran, so it ended. Continue it, or start a new session from what is saved.'
/** While Claude is in one of these, the human waits for its turn to finish. */
const REPLYING_STATUSES: SessionStatus[] = ['thinking', 'writing', 'starting']

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
    accepted: false,
    stopping: false,
    queue: Promise.resolve(),
    ended,
    markEnded,
  }
}

/** Asks the session's Claude Code to exit, and kills it if it is still running after the grace period. */
function requestStop(live: Live) {
  live.stopping = true
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

const humanMessage = (kind: 'answer' | 'message' | 'write', text: string): ChatMessage => ({
  id: newId('m'),
  at: now(),
  role: 'human',
  kind,
  text,
})

/** Marks a Transcript that was still running when the backend went down as interrupted, and saves it. */
async function markInterruptedIfLive<T extends AnyTranscript>(transcript: T, save: (transcript: T) => Promise<void>) {
  if (!LIVE_STATUSES.includes(transcript.status)) return
  Object.assign(transcript, { status: 'interrupted', endedAt: now() })
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
  /** `ended` promises of sessions whose Transcript is not saved yet — they may already be out of `live`. */
  private unsaved = new Set<Promise<void>>()
  private deps: GrillingDeps & TemplateSessionDeps

  constructor(deps: GrillingDeps & TemplateSessionDeps) {
    this.deps = deps
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

  async start(args: StartArgs): Promise<SessionSummary> {
    if (this.liveForDraft(args.draftId)) throw new SessionError(ALREADY_RUNNING_ON_DRAFT)
    return summaryOf(await this.launch(await prepareGrillingSession(args, this.deps)))
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
  }: PreparedSession<T>): Promise<T> {
    const token = randomUUID()
    const conversation = { persist: scope.persist, ...(resume ? { resume } : {}) }
    const child = spawnClaude({
      sessionId: transcript.id,
      token,
      scope,
      seed,
      model: (await getSettings()).model,
      conversation,
    })
    const live = newLive(transcript, scope, child, token)
    this.live.set(transcript.id, live)
    this.unsaved.add(live.ended)
    void live.ended.then(() => this.unsaved.delete(live.ended))
    this.watch(live)

    await this.push(live, systemMessage(intro))
    if (transcript.humanNote) await this.push(live, humanMessage('message', transcript.humanNote))
    sendMessage(child, seed.firstMessage)
    await this.setStatus(live, 'thinking')
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

  async say(sessionId: string, text: string, kind: 'answer' | 'message') {
    const live = this.get(sessionId)
    const said = text.trim()
    if (!said) throw new SessionError('Say something first.')
    if (REPLYING_STATUSES.includes(live.transcript.status))
      throw new SessionError('Claude is still replying — wait for its turn to finish.')
    await this.push(live, humanMessage(kind, said))
    sendMessage(live.child, said)
    await this.setStatus(live, 'thinking')
  }

  /** The human confirms the Ready Check, or says "enough — write it" at any moment. */
  async writeNow(sessionId: string) {
    const live = this.get(sessionId)
    if (live.transcript.status === 'writing') return
    if (live.transcript.status !== 'waiting')
      throw new SessionError('Claude is still replying — wait for its turn to finish, then press write.')
    live.transcript.writeConfirmed = true
    await this.push(live, humanMessage('write', WRITE_NOW_MESSAGE))
    sendMessage(live.child, WRITE_NOW_MESSAGE)
    await this.setStatus(live, 'writing')
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
    if (!live.accepted) return this.setStatus(live, 'waiting')
    live.child.stdin?.end()
    await this.end(live, 'finished')
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
    if (!live.transcript.writeConfirmed)
      return refuse([
        {
          code: 'not-confirmed',
          message: `The human has not confirmed yet. Run the Ready Check and wait for "${WRITE_NOW_MESSAGE}".`,
        },
      ])
    if (live.accepted)
      return refuse([{ code: 'already-submitted', message: 'This session already submitted successfully. Stop here.' }])

    const result = await live.scope.submit(payload)
    if (!result.ok) return refuse(result.reasons)
    live.accepted = true
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

  private async setStatus(live: Live, status: SessionStatus) {
    if (live.transcript.status === status) return
    live.transcript.status = status
    await live.scope.save(live.transcript)
    live.scope.emitSession(live.transcript)
  }

  private async onExit(live: Live, code: number | null, signal: NodeJS.Signals | null) {
    await live.queue
    if (!this.live.has(live.transcript.id)) return
    if (live.accepted) return this.end(live, 'finished')
    if (live.stopping) return this.end(live, 'stopped')
    await this.end(live, 'failed', crashError(live.stderrTail, code, signal))
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
