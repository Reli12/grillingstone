// Every session in view (all Grilling Sessions on a Draft, or one Template Session), oldest first.
// Finished sessions fold into a line and open as a read-only Transcript; the live one shows question
// cards and the Ready Check. An ended one may offer Continue (ADR-0014).
import { createElement, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  BookOpenText,
  ChevronRight,
  CornerDownRight,
  FileText,
  Globe,
  Search,
  Send,
  ShieldAlert,
  Wrench,
} from 'lucide-react'

import type { ChatMessage, SessionBase } from '#core/session/sessionTypes.ts'

import { RichText } from '@/components/atoms/richText/richText'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { QuestionCard } from '@/components/features/chat/questionCard/questionCard'
import { ReadyCard } from '@/components/features/chat/readyCard/readyCard'
import { SESSION_TITLES, writeTarget } from '@/constants/SessionConstants'
import { cn } from '@/lib/cn'

/** Any session's Transcript — Grilling or Template Session. */
type AnyTranscript = SessionBase & { messages: ChatMessage[]; continues?: string }

type HumanMessage = Extract<ChatMessage, { role: 'human' }>
type SystemMessage = Extract<ChatMessage, { role: 'system' }>
type ToolMessage = Extract<ChatMessage, { role: 'tool' }>
type ClaudeMessage = Extract<ChatMessage, { role: 'claude' }>

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

/** Stay pinned to the newest message while the reader is within this distance of the bottom. */
const STICK_TO_BOTTOM_PX = 80

const SYSTEM_TONE_CLASS: Record<NonNullable<SystemMessage['tone']>, string> = {
  info: 'text-ink-faint',
  success: 'font-medium text-proof',
  error: 'text-redpencil',
}

const time = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function toolIcon(message: ToolMessage) {
  if (message.outcome === 'denied') return ShieldAlert
  if (message.summary.includes('Glossary')) return BookOpenText
  switch (message.tool) {
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

function HumanBubble({ message }: Readonly<{ message: HumanMessage }>) {
  return (
    <div className="flex justify-end">
      <p
        className={cn(
          'max-w-[85%] rounded-lg px-3.5 py-2 text-[15px] whitespace-pre-wrap',
          message.kind === 'write' ? 'bg-proof text-on-accent' : 'bg-ink text-on-ink',
        )}
      >
        {message.text}
      </p>
    </div>
  )
}

function SystemLine({ message }: Readonly<{ message: SystemMessage }>) {
  return (
    <p className={cn('mx-auto max-w-[90%] text-center text-[13px]', SYSTEM_TONE_CLASS[message.tone ?? 'info'])}>
      {message.text}
    </p>
  )
}

function ToolLine({ message }: Readonly<{ message: ToolMessage }>) {
  const icon = createElement(toolIcon(message), { size: 14, className: 'shrink-0' })
  const failed = message.outcome === 'denied' || message.outcome === 'error'
  return (
    <p className={cn('flex items-center gap-2 pl-3 text-[13px]', failed ? 'text-redpencil' : 'text-ink-faint')}>
      {icon}
      <span className="truncate">{message.summary}</span>
      {message.outcome === 'denied' && <span className="shrink-0">(blocked by the session allowlist)</span>}
      {message.outcome === 'error' && message.tool === 'Bash' && <span className="shrink-0">(refused)</span>}
    </p>
  )
}

interface ClaudeTurnProps {
  message: ClaudeMessage
  transcript: AnyTranscript
  /** The human's reply to this turn, if one came after it. */
  answer?: HumanMessage
  /** This is Claude's latest turn and the human may answer it now. */
  actionable: boolean
  handlers: Handlers
}

function ClaudeTurn({ message, transcript, answer, actionable, handlers }: Readonly<ClaudeTurnProps>) {
  return (
    <div className="space-y-3 border-l-2 border-claude/60 pl-3">
      {message.segments.map((segment, index) => {
        if (segment.type === 'text')
          return <RichText key={index} text={segment.text} className="text-[15px] leading-relaxed text-ink" />
        if (segment.type === 'question')
          return (
            <QuestionCard
              key={index}
              q={segment}
              answer={answer?.text}
              canAnswer={actionable}
              onAnswer={(text) => handlers.onAnswer(transcript.id, text)}
            />
          )
        return (
          <ReadyCard
            key={index}
            summary={segment.summary}
            target={writeTarget(transcript.kind)}
            open={actionable && !answer}
            onWrite={() => handlers.onWrite(transcript.id)}
            onAdd={handlers.onAddSomething}
          />
        )
      })}
    </div>
  )
}

interface MessagesProps extends Handlers {
  transcript: AnyTranscript
  live: boolean
}

function Messages({ transcript, live, ...handlers }: Readonly<MessagesProps>) {
  const { messages } = transcript
  const lastClaude = messages.findLastIndex((message) => message.role === 'claude')
  const canAct = live && transcript.status === 'waiting'
  return (
    <div className="space-y-3.5">
      {messages.map((message, i) => {
        if (message.role === 'human') return <HumanBubble key={message.id} message={message} />
        if (message.role === 'system') return <SystemLine key={message.id} message={message} />
        if (message.role === 'tool') return <ToolLine key={message.id} message={message} />
        const answer = messages.slice(i + 1).find((later): later is HumanMessage => later.role === 'human')
        return (
          <ClaudeTurn
            key={message.id}
            message={message}
            transcript={transcript}
            answer={answer}
            actionable={canAct && i === lastClaude}
            handlers={handlers}
          />
        )
      })}
    </div>
  )
}

interface SessionHeadingProps {
  transcript: AnyTranscript
}

function SessionHeading({ transcript }: Readonly<SessionHeadingProps>) {
  return (
    <>
      <span className="font-semibold text-ink">{SESSION_TITLES[transcript.kind]}</span>
      {transcript.focus && <span className="text-ink-soft"> on {transcript.focus.heading}</span>}
      <span className="text-ink-faint">
        , {time(transcript.startedAt)}, {STATUS_TEXT[transcript.status]}
      </span>
    </>
  )
}

interface ContinueButtonProps {
  transcript: AnyTranscript
  onContinue: (sessionId: string) => void
}

function ContinueButton({ transcript, onContinue }: Readonly<ContinueButtonProps>) {
  return (
    <button
      onClick={() => onContinue(transcript.id)}
      aria-label={`Continue ${SESSION_TITLES[transcript.kind]}`}
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-claude hover:bg-fog-deep"
    >
      <CornerDownRight size={13} /> Continue
    </button>
  )
}

interface FoldedSessionProps {
  transcript: AnyTranscript
  continueButton: ReactNode
  onOpen: () => void
}

/** A finished session folded into one line; clicking it opens the read-only Transcript. */
function FoldedSession({ transcript, continueButton, onOpen }: Readonly<FoldedSessionProps>) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-line-soft bg-sheet/60 pr-1.5 hover:border-line">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[13px]">
        <ChevronRight size={14} className="shrink-0 text-ink-faint" />
        <span className="truncate">
          <SessionHeading transcript={transcript} />
        </span>
        <span className="ml-auto shrink-0 text-ink-faint">Read transcript</span>
      </button>
      {continueButton}
    </div>
  )
}

/** Tells the reader what Claude knew when this session started: a Continuation, or a fresh start. */
function SessionOrigin({ transcript, first }: Readonly<{ transcript: AnyTranscript; first: boolean }>) {
  if (transcript.continues)
    return (
      <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
        Claude continues an earlier conversation, with the current Draft in hand.
      </p>
    )
  if (first) return null
  return (
    <p className="-mt-2 mb-4 text-center text-[12px] text-ink-faint">
      Claude started fresh from the current Draft — it doesn’t see the chat above.
    </p>
  )
}

interface ExpandedSessionProps {
  transcript: AnyTranscript
  first: boolean
  live: boolean
  continueButton: ReactNode
  handlers: Handlers
}

function ExpandedSession({ transcript, first, live, continueButton, handlers }: Readonly<ExpandedSessionProps>) {
  return (
    <section aria-label={`${SESSION_TITLES[transcript.kind]} transcript`}>
      <h3 className="mb-4 flex items-center gap-3 text-[13px]">
        <span className="h-px flex-1 bg-line" />
        <span>
          <SessionHeading transcript={transcript} />
        </span>
        {continueButton}
        <span className="h-px flex-1 bg-line" />
      </h3>
      <SessionOrigin transcript={transcript} first={first} />
      <Messages transcript={transcript} live={live} {...handlers} />
    </section>
  )
}

/**
 * Keeps the returned scroller pinned to the bottom as messages arrive, unless the reader has
 * scrolled up to read something earlier.
 */
function useStickToBottom(messageCount: number, liveStatus?: string) {
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useLayoutEffect(() => {
    const element = scroller.current
    if (element && stick.current) element.scrollTop = element.scrollHeight
  }, [messageCount, liveStatus])
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const onScroll = () => {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
      stick.current = distanceFromBottom < STICK_TO_BOTTOM_PX
    }
    element.addEventListener('scroll', onScroll)
    return () => element.removeEventListener('scroll', onScroll)
  }, [])
  return scroller
}

interface ContinueOptions {
  /** Offers Continue on the ended sessions it accepts. */
  canContinue?: (transcript: AnyTranscript) => boolean
  onContinue?: (sessionId: string) => void
}

interface ThreadSessionProps extends ContinueOptions {
  transcript: AnyTranscript
  expanded: boolean
  first: boolean
  live: boolean
  onOpen: () => void
  handlers: Handlers
}

/** One session of the thread: folded into a line, or open with its messages. */
function ThreadSession({
  transcript,
  expanded,
  first,
  live,
  onOpen,
  canContinue,
  onContinue,
  handlers,
}: Readonly<ThreadSessionProps>) {
  const offerContinue = onContinue && canContinue?.(transcript)
  const continueButton = offerContinue ? <ContinueButton transcript={transcript} onContinue={onContinue} /> : null
  if (!expanded) return <FoldedSession transcript={transcript} continueButton={continueButton} onOpen={onOpen} />
  return (
    <ExpandedSession
      transcript={transcript}
      first={first}
      live={live}
      continueButton={continueButton}
      handlers={handlers}
    />
  )
}

interface ChatThreadProps extends Handlers, ContinueOptions {
  transcripts: AnyTranscript[]
  liveSessionId?: string
  className?: string
}

export function ChatThread({
  transcripts,
  liveSessionId,
  canContinue,
  onContinue,
  className,
  ...handlers
}: Readonly<ChatThreadProps>) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const latest = transcripts.at(-1)
  const live = transcripts.find((transcript) => transcript.id === liveSessionId)
  const messageCount = transcripts.reduce((total, transcript) => total + transcript.messages.length, 0)
  const claudeBusy = live?.status === 'thinking' || live?.status === 'starting'
  const scroller = useStickToBottom(messageCount, live?.status)

  // The latest and the live session are always open; older ones open when the human asks.
  const isExpanded = (transcript: AnyTranscript) =>
    transcript.id === latest?.id || transcript.id === liveSessionId || openIds.has(transcript.id)

  return (
    <div ref={scroller} className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      <div className="mx-auto max-w-[720px] space-y-6 px-4 py-6">
        {transcripts.map((transcript, index) => (
          <ThreadSession
            key={transcript.id}
            transcript={transcript}
            expanded={isExpanded(transcript)}
            first={index === 0}
            live={transcript.id === liveSessionId}
            onOpen={() => setOpenIds(new Set(openIds).add(transcript.id))}
            canContinue={canContinue}
            onContinue={onContinue}
            handlers={handlers}
          />
        ))}
        {claudeBusy && <Thinking className="pl-3" />}
        {live?.status === 'writing' && (
          <Thinking className="pl-3" label={`Claude is writing ${writeTarget(live.kind)}`} />
        )}
      </div>
    </div>
  )
}
