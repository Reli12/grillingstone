import type { Seed } from '#core/session/cardProtocol.ts'
import type { ChatMessage, TemplateTranscript, Transcript } from '#core/session/sessionTypes.ts'
import type { Reason } from '#core/shared/validation.ts'

export type AnyTranscript = Transcript | TemplateTranscript
export type SubmitResult = { ok: true; message: string } | { ok: false; reasons: Reason[] }

/**
 * What differs between the two kinds of session: where one runs, where its Transcript lives, how it is
 * announced, and what its submission means. The Supervisor runs both the same way.
 */
export interface Scope {
  /** The session's working directory — the only folder it may read. */
  cwd: string
  guardMode: 'grilling' | 'template'
  save: (t: AnyTranscript) => Promise<void>
  emitMessage: (t: AnyTranscript, m: ChatMessage) => void
  emitSession: (t: AnyTranscript) => void
  /** Validates and stores what the session submitted. */
  submit: (payload: unknown) => Promise<SubmitResult>
  /** How the submit command shows up in the chat. */
  submitLabel: string
  /** A tool result edited the Project Glossary. */
  onGlossaryEdit?: () => void
  /** Claude Code keeps the conversation so the session can be continued (ADR-0014). */
  persist: boolean
}

/** A session ready to launch. */
export interface PreparedSession<T extends AnyTranscript> {
  transcript: T
  scope: Scope
  seed: Seed
  /** The first system line in the chat. */
  intro: string
  /** Claude Code's conversation to resume, for a Continuation. */
  resume?: string
}

export const summaryOf = <T extends AnyTranscript>({ messages: _m, ...s }: T) => s as Omit<T, 'messages'>
