// Session Supervisor (ADR-0001, ADR-0006, ADR-0010): the registry of running sessions. It launches one
// headless `claude -p` per session, relays the human's turns, keeps the Transcript from Claude's output, and
// accepts what a session writes only through the submit script. What each kind of session is — where it
// runs and what its submission means — comes from grillingSession.ts and templateSession.ts.
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { WRITE_NOW_MESSAGE } from '#core/session/cardProtocol.ts'
import { continuation } from '#core/session/continuation.ts'
import { LIVE_STATUSES, type ChatMessage, type SessionStatus, type SessionSummary, type TemplateRequest, type TemplateSessionSummary } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import type { Reason } from '#core/shared/validation.ts'
import { CLAUDE_BIN } from '../config.ts'
import { now } from '../services/clock.ts'
import { allProjectIds } from '../storage/projects.ts'
import { getSettings } from '../storage/settings.ts'
import { getDraft } from '../storage/drafts.ts'
import { getTemplate } from '../storage/templates.ts'
import { getTranscript, listTemplateTranscripts, listTranscripts, saveTemplateTranscript, saveTranscript } from '../storage/transcripts.ts'
import { jsonLines, sendMessage, spawnClaude } from './claudeProcess.ts'
import { prepareGrillingSession, type GrillingDeps, type StartArgs } from './grillingSession.ts'
import { SessionError } from './sessionError.ts'
import { summaryOf, type AnyTranscript, type PreparedSession, type Scope, type SubmitResult } from './sessionScope.ts'
import { readStreamEvent, type KnownTool } from './streamEvents.ts'
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
}

const systemMessage = (text: string, tone?: 'success' | 'error'): ChatMessage => ({ id: newId('m'), at: now(), role: 'system', ...(tone ? { tone } : {}), text })

export class Supervisor {
  private live = new Map<string, Live>()
  private deps: GrillingDeps & TemplateSessionDeps

  constructor(deps: GrillingDeps & TemplateSessionDeps) {
    this.deps = deps
  }

  /** Sessions cannot survive a backend restart; mark the ones that were running. */
  async markInterrupted() {
    const interrupt = async <T extends AnyTranscript>(t: T, save: (t: T) => Promise<void>) => {
      if (!LIVE_STATUSES.includes(t.status)) return
      Object.assign(t, { status: 'interrupted', endedAt: now() })
      t.messages.push(systemMessage('The backend restarted while this session ran, so it ended. Continue it, or start a new session from what is saved.', 'error'))
      await save(t)
    }
    for (const projectId of await allProjectIds()) for (const t of await listTranscripts(projectId)) await interrupt(t, saveTranscript)
    for (const t of await listTemplateTranscripts()) await interrupt(t, saveTemplateTranscript)
  }

  liveForDraft(draftId: string): SessionSummary | undefined {
    for (const l of this.live.values()) if (l.transcript.kind !== 'template' && l.transcript.draftId === draftId) return summaryOf(l.transcript)
    return undefined
  }

  liveTemplateSession(): TemplateSessionSummary | undefined {
    for (const l of this.live.values()) if (l.transcript.kind === 'template') return summaryOf(l.transcript)
    return undefined
  }

  stopAll() {
    for (const l of this.live.values()) {
      l.stopping = true
      l.child.kill('SIGTERM')
    }
  }

  // ── Starting ────────────────────────────────────────────────────────────

  async start(args: StartArgs): Promise<SessionSummary> {
    if (this.liveForDraft(args.draftId)) throw new SessionError('A session is already running on this Draft — finish or stop it first.')
    return summaryOf(await this.launch(await prepareGrillingSession(args, this.deps)))
  }

  /** A Continuation (ADR-0014): a new session that resumes an ended one's Claude Code conversation. */
  async continue(projectId: string, draftId: string, sessionId: string, humanNote?: string): Promise<SessionSummary> {
    const earlier = await getTranscript(projectId, sessionId)
    if (earlier.draftId !== draftId) throw new SessionError('This session belongs to another Draft.')
    if (this.liveForDraft(draftId)) throw new SessionError('A session is already running on this Draft — finish or stop it first.')
    const draft = await getDraft(projectId, draftId)
    const latest = await getTemplate(draft.template.id).catch(() => undefined)
    const next = continuation(summaryOf(earlier), draft, latest?.version)
    if (!next.ok) throw new SessionError(next.reason)
    return this.start({ projectId, draftId, kind: next.kind, focus: next.focus, humanNote, continues: summaryOf(earlier) })
  }

  async startTemplate(request: TemplateRequest): Promise<TemplateSessionSummary> {
    if (this.liveTemplateSession()) throw new SessionError('A Template Session is already running — continue or stop it first.')
    return summaryOf(await this.launch(await prepareTemplateSession(request, this.deps)))
  }

  private async launch<T extends AnyTranscript>({ transcript, scope, seed, intro, resume }: PreparedSession<T>): Promise<T> {
    const token = randomUUID()
    const conversation = { persist: scope.persist, ...(resume ? { resume } : {}) }
    const child = spawnClaude({ sessionId: transcript.id, token, scope, seed, model: (await getSettings()).model, conversation })
    const live: Live = { transcript, scope, child, token, stderrTail: '', tools: new Map(), accepted: false, stopping: false, queue: Promise.resolve() }
    this.live.set(transcript.id, live)

    child.stdout!.setEncoding('utf8')
    child.stdout!.on(
      'data',
      jsonLines((event) => {
        live.queue = live.queue.then(() => this.onEvent(live, event)).catch((e) => console.error('[supervisor] event handling failed', e))
      }),
    )
    child.stderr!.setEncoding('utf8')
    child.stderr!.on('data', (chunk: string) => {
      live.stderrTail = (live.stderrTail + chunk).slice(-4000)
    })
    child.on('error', (e) => void this.end(live, 'failed', `Could not start Claude Code (${CLAUDE_BIN}): ${e.message}`))
    child.on('exit', (code, signal) => void this.onExit(live, code, signal))

    await this.push(live, systemMessage(intro))
    if (transcript.humanNote) await this.push(live, { id: newId('m'), at: now(), role: 'human', kind: 'message', text: transcript.humanNote })
    sendMessage(child, seed.firstMessage)
    await this.setStatus(live, 'thinking')
    return transcript
  }

  // ── Human input ─────────────────────────────────────────────────────────

  private get(sessionId: string): Live {
    const l = this.live.get(sessionId)
    if (!l) throw new SessionError('This session is no longer running.')
    return l
  }

  async say(sessionId: string, text: string, kind: 'answer' | 'message') {
    const l = this.get(sessionId)
    if (!text.trim()) throw new SessionError('Say something first.')
    if (l.transcript.status === 'thinking' || l.transcript.status === 'writing' || l.transcript.status === 'starting')
      throw new SessionError('Claude is still replying — wait for its turn to finish.')
    await this.push(l, { id: newId('m'), at: now(), role: 'human', kind, text: text.trim() })
    sendMessage(l.child, text.trim())
    await this.setStatus(l, 'thinking')
  }

  /** The human confirms the Ready Check, or says "enough — write it" at any moment. */
  async writeNow(sessionId: string) {
    const l = this.get(sessionId)
    if (l.transcript.status === 'writing') return
    if (l.transcript.status !== 'waiting') throw new SessionError('Claude is still replying — wait for its turn to finish, then press write.')
    l.transcript.writeConfirmed = true
    await this.push(l, { id: newId('m'), at: now(), role: 'human', kind: 'write', text: WRITE_NOW_MESSAGE })
    sendMessage(l.child, WRITE_NOW_MESSAGE)
    await this.setStatus(l, 'writing')
  }

  async stop(sessionId: string) {
    const l = this.get(sessionId)
    l.stopping = true
    l.child.kill('SIGTERM')
    setTimeout(() => l.child.exitCode === null && l.child.kill('SIGKILL'), 3000).unref()
  }

  // ── Claude's output ─────────────────────────────────────────────────────

  private async onEvent(l: Live, event: Record<string, unknown>) {
    for (const step of readStreamEvent(event, { cwd: l.scope.cwd, submitLabel: l.scope.submitLabel, tools: l.tools })) {
      if (step.type === 'message') {
        if (step.toolUseId && step.tool) l.tools.set(step.toolUseId, step.tool)
        await this.push(l, step.message)
      } else if (step.type === 'claudeSession') {
        if (l.transcript.claudeSessionId === step.id) continue
        l.transcript.claudeSessionId = step.id
        await l.scope.save(l.transcript)
      } else if (step.type === 'toolResult') {
        await this.updateTool(l, step.messageId, step.outcome)
        if (step.glossaryEdited) l.scope.onGlossaryEdit?.()
      } else if (l.accepted) {
        l.child.stdin?.end()
        await this.end(l, 'finished')
      } else await this.setStatus(l, 'waiting')
    }
  }

  // ── Submissions (from scripts/writeDraft.mjs) ───────────────────────────

  async submit(sessionId: string, token: string, payload: unknown): Promise<SubmitResult> {
    const l = this.live.get(sessionId)
    if (!l || l.token !== token) return { ok: false, reasons: [{ code: 'unknown-session', message: 'This session is not running.' }] }
    const refuse = async (reasons: Reason[]) => {
      await this.push(l, systemMessage(`Submission refused — ${reasons.map((r) => r.message).join(' · ')}`, 'error'))
      return { ok: false as const, reasons }
    }
    if (!l.transcript.writeConfirmed)
      return refuse([{ code: 'not-confirmed', message: `The human has not confirmed yet. Run the Ready Check and wait for "${WRITE_NOW_MESSAGE}".` }])
    if (l.accepted) return refuse([{ code: 'already-submitted', message: 'This session already submitted successfully. Stop here.' }])

    const result = await l.scope.submit(payload)
    if (!result.ok) return refuse(result.reasons)
    l.accepted = true
    await this.push(l, systemMessage(result.message, 'success'))
    return result
  }

  // ── Transcript bookkeeping ──────────────────────────────────────────────

  private async push(l: Live, message: ChatMessage) {
    l.transcript.messages.push(message)
    await l.scope.save(l.transcript)
    l.scope.emitMessage(l.transcript, message)
  }

  private async updateTool(l: Live, messageId: string, outcome: 'ok' | 'denied' | 'error') {
    const msg = l.transcript.messages.find((m) => m.id === messageId)
    if (!msg || msg.role !== 'tool') return
    msg.outcome = outcome
    await l.scope.save(l.transcript)
    l.scope.emitMessage(l.transcript, msg)
  }

  private async setStatus(l: Live, status: SessionStatus) {
    if (l.transcript.status === status) return
    l.transcript.status = status
    await l.scope.save(l.transcript)
    l.scope.emitSession(l.transcript)
  }

  private async onExit(l: Live, code: number | null, signal: NodeJS.Signals | null) {
    await l.queue
    if (!this.live.has(l.transcript.id)) return
    if (l.accepted) return this.end(l, 'finished')
    if (l.stopping) return this.end(l, 'stopped')
    const tail = l.stderrTail.trim().split('\n').slice(-5).join('\n')
    await this.end(l, 'failed', `Claude Code exited (${signal ?? `code ${code}`})${tail ? `: ${tail}` : '.'}`)
  }

  private async end(l: Live, status: SessionStatus, error?: string) {
    if (!this.live.has(l.transcript.id)) return
    this.live.delete(l.transcript.id)
    if (l.child.exitCode === null) l.child.kill('SIGTERM')
    const t = l.transcript
    t.endedAt = now()
    let last: ChatMessage | undefined
    if (error) {
      t.error = error
      last = systemMessage(error, 'error')
    } else if (status === 'stopped') {
      last = systemMessage('Session stopped. Nothing was written.')
    }
    if (last) t.messages.push(last)
    t.status = status
    await l.scope.save(t)
    if (last) l.scope.emitMessage(t, last)
    l.scope.emitSession(t)
  }
}
