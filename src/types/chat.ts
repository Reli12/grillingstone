// Any session's Transcript — Grilling or Template Session.
import type { Segment } from '#core/session/blockExtractor.ts'
import type { ChatMessage, SessionBase } from '#core/session/sessionTypes.ts'

/** Any session's Transcript — Grilling or Template Session. */
export type AnyTranscript = SessionBase & { messages: ChatMessage[]; continues?: string }

export type HumanMessage = Extract<ChatMessage, { role: 'human' }>

export type SystemMessage = Extract<ChatMessage, { role: 'system' }>

export type ToolMessage = Extract<ChatMessage, { role: 'tool' }>

export type ClaudeMessage = Extract<ChatMessage, { role: 'claude' }>

export interface Handlers {
  onAnswer: (sessionId: string, text: string) => void
  onWrite: (sessionId: string) => void
  onAddSomething: () => void
}

export interface ContinueOptions {
  /** Offers Continue on the ended sessions it accepts. */
  canContinue?: (transcript: AnyTranscript) => boolean
  onContinue?: (sessionId: string) => void
}

export interface Continuing {
  label: string
  onCancel: () => void
}

export type Question = Extract<Segment, { type: 'question' }>
