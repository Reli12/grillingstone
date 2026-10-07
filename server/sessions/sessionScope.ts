// The shared shape of a session, whichever kind it is: the Scope that says where it runs and what its
// submission means, and the PreparedSession the Supervisor launches.
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
  save: (transcript: AnyTranscript) => Promise<void>
  emitMessage: (transcript: AnyTranscript, message: ChatMessage) => void
  emitSession: (transcript: AnyTranscript) => void
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

/** The Transcript without its messages: what lists and live-session lookups send to the browser. */
export const summaryOf = <T extends AnyTranscript>({ messages: _messages, ...summary }: T) => summary
