// Every session in view (all Grilling Sessions on a Draft, or one Template Session), oldest first. Finished sessions fold into a line and open as a
// read-only Transcript; the live one shows question cards and the Ready Check. An ended one may offer Continue (ADR-0014).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BookOpenText, ChevronRight, CornerDownRight, FileText, Globe, Search, Send, ShieldAlert, Wrench } from 'lucide-react'
import type { ChatMessage, SessionBase } from '#core/session/sessionTypes.ts'
import { RichText } from '@/components/atoms/richText/richText'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { QuestionCard } from '@/components/features/chat/questionCard/questionCard'
import { ReadyCard } from '@/components/features/chat/readyCard/readyCard'
import { SESSION_TITLES, writeTarget } from '@/constants/SessionConstants'
import { cn } from '@/lib/cn'

/** Any session's Transcript — Grilling or Template Session. */
type AnyTranscript = SessionBase & { messages: ChatMessage[]; continues?: string }

const STATUS_TEXT: Record<SessionBase['status'], string> = {
  starting: 'starting',
  thinking: 'running',
  waiting: 'running',
  writing: 'writing',
  finished: 'finished',
  stopped: 'stopped',
  failed: 'failed',
  interrupted: 'interrupted',
}

const time = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function toolIcon(m: Extract<ChatMessage, { role: 'tool' }>) {
  if (m.outcome === 'denied') return ShieldAlert
  if (m.summary.includes('Glossary')) return BookOpenText
  switch (m.tool) {
    case 'Read':
      return FileText
    case 'Grep':
    case 'Glob':
      return Search
    case 'WebSearch':
    case 'WebFetch':
      return Globe
    case 'Bash':
      return Send
    default:
      return Wrench
  }
}

interface Handlers {
  onAnswer: (sessionId: string, text: string) => void
  onWrite: (sessionId: string) => void
  onAddSomething: () => void
}

interface MessagesProps extends Handlers {
  t: AnyTranscript
  live: boolean
}

function Messages({ t, live, ...h }: MessagesProps) {
  const lastClaude = t.messages.findLastIndex((m) => m.role === 'claude')
  const canAct = live && t.status === 'waiting'
  return (
    <div className="space-y-3.5">
      {t.messages.map((m, i) => {
        if (m.role === 'human')
          return (
            <div key={m.id} className="flex justify-end">
              <p className={cn('max-w-[85%] rounded-lg px-3.5 py-2 text-[15px] whitespace-pre-wrap', m.kind === 'write' ? 'bg-proof text-on-accent' : 'bg-ink text-on-ink')}>{m.text}</p>
            </div>
          )
        if (m.role === 'system')
          return (
            <p
              key={m.id}
              className={cn(
                'mx-auto max-w-[90%] text-center text-[13px]',
                m.tone === 'success' ? 'font-medium text-proof' : m.tone === 'error' ? 'text-redpencil' : 'text-ink-faint',
              )}
            >
              {m.text}
            </p>
          )
        if (m.role === 'tool') {
          const Icon = toolIcon(m)
          return (
            <p key={m.id} className={cn('flex items-center gap-2 pl-3 text-[13px]', m.outcome === 'denied' || m.outcome === 'error' ? 'text-redpencil' : 'text-ink-faint')}>
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{m.summary}</span>
              {m.outcome === 'denied' && <span className="shrink-0">(blocked by the session allowlist)</span>}
              {m.outcome === 'error' && m.tool === 'Bash' && <span className="shrink-0">(refused)</span>}
            </p>
          )
        }
        // Claude
        const later = t.messages.slice(i + 1)
        const answer = later.find((x) => x.role === 'human')
        return (
          <div key={m.id} className="space-y-3 border-l-2 border-claude/60 pl-3">
            {m.segments.map((s, k) => {
              if (s.type === 'text') return <RichText key={k} text={s.text} className="text-[15px] leading-relaxed text-ink" />
              if (s.type === 'question')
                return (
                  <QuestionCard
                    key={k}
                    q={s}
                    answer={answer?.role === 'human' ? answer.text : undefined}
                    canAnswer={canAct && i === lastClaude}
                    onAnswer={(text) => h.onAnswer(t.id, text)}
                  />
                )
              return (
                <ReadyCard
                  key={k}
                  summary={s.summary}
                  target={writeTarget(t.kind)}
                  open={canAct && i === lastClaude && !answer}
                  onWrite={() => h.onWrite(t.id)}
                  onAdd={h.onAddSomething}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

interface SessionHeadingProps {
  t: AnyTranscript
}

function SessionHeading({ t }: SessionHeadingProps) {
  return (
    <>
      <span className="font-semibold text-ink">{SESSION_TITLES[t.kind]}</span>
      {t.focus && <span className="text-ink-soft"> on {t.focus.heading}</span>}
      <span className="text-ink-faint">
        , {time(t.startedAt)}, {STATUS_TEXT[t.status]}
      </span>
    </>
  )
}

interface ContinueButtonProps {
  t: AnyTranscript
  onContinue: (sessionId: string) => void
}

function ContinueButton({ t, onContinue }: ContinueButtonProps) {
  return (
    <button
      onClick={() => onContinue(t.id)}
      aria-label={`Continue ${SESSION_TITLES[t.kind]}`}
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-claude hover:bg-fog-deep"
    >
      <CornerDownRight size={13} /> Continue
    </button>
  )
}

interface ChatThreadProps extends Handlers {
  transcripts: AnyTranscript[]
  liveSessionId?: string
  /** Offers Continue on the ended sessions it accepts. */
  canContinue?: (t: AnyTranscript) => boolean
  onContinue?: (sessionId: string) => void
  className?: string
}

export function ChatThread({ transcripts, liveSessionId, canContinue, onContinue, className, ...h }: ChatThreadProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const latest = transcripts.at(-1)
  const live = transcripts.find((t) => t.id === liveSessionId)
  const count = transcripts.reduce((n, t) => n + t.messages.length, 0)

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [count, live?.status])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => (stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={scroller} className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      <div className="mx-auto max-w-[720px] space-y-6 px-4 py-6">
        {transcripts.map((t, index) => {
          const expanded = t.id === latest?.id || t.id === liveSessionId || openIds.has(t.id)
          const continueButton = onContinue && canContinue?.(t) ? <ContinueButton t={t} onContinue={onContinue} /> : null
          if (!expanded)
            return (
              <div key={t.id} className="flex items-center gap-1 rounded-md border border-line-soft bg-sheet/60 pr-1.5 hover:border-line">
                <button onClick={() => setOpenIds(new Set(openIds).add(t.id))} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[13px]">
                  <ChevronRight size={14} className="shrink-0 text-ink-faint" />
                  <span className="truncate">
                    <SessionHeading t={t} />
                  </span>
                  <span className="ml-auto shrink-0 text-ink-faint">Read transcript</span>
                </button>
                {continueButton}
              </div>
            )
          return (
            <section key={t.id} aria-label={`${SESSION_TITLES[t.kind]} transcript`}>
              <h3 className="mb-4 flex items-center gap-3 text-[13px]">
                <span className="h-px flex-1 bg-line" />
                <span>
                  <SessionHeading t={t} />
                </span>
                {continueButton}
                <span className="h-px flex-1 bg-line" />
              </h3>
              {t.continues ? (
                <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">Claude continues an earlier conversation, with the current Draft in hand.</p>
              ) : (
                index > 0 && <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">Claude started fresh from the current Draft — it doesn’t see the chat above.</p>
              )}
              <Messages t={t} live={t.id === liveSessionId} {...h} />
            </section>
          )
        })}
        {live && (live.status === 'thinking' || live.status === 'starting') && <Thinking className="pl-3" />}
        {live?.status === 'writing' && <Thinking className="pl-3" label={`Claude is writing ${writeTarget(live.kind)}`} />}
      </div>
    </div>
  )
}
