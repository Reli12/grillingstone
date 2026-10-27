// The shared shape of a session, whichever kind it is: the Scope that says where it runs and what its
// submission means, and the PreparedSession the Supervisor launches.
import type { PrototypeGrillingSession, PrototypeSession } from '#core/prototype/prototypeRecords.ts'
import type { Seed } from '#core/session/cardProtocol.ts'
import type { ImageRef, ImageUpload, NumberedImage, ValidImage } from '#core/session/images.ts'
import type { GuardMode } from '#core/session/permissionGuard.ts'
import type { ChatMessage, TemplateTranscript, Transcript } from '#core/session/sessionTypes.ts'
import type { Reason } from '#core/shared/validation.ts'

export type AnyTranscript = Transcript | TemplateTranscript | PrototypeSession | PrototypeGrillingSession
export type SubmitResult = { ok: true; message: string } | { ok: false; reasons: Reason[] }

export const isGrillingTranscript = (transcript: AnyTranscript): transcript is Transcript =>
  transcript.kind !== 'template' && transcript.kind !== 'prototype' && transcript.kind !== 'prototypeGrilling'
export const isPrototypeSession = (transcript: AnyTranscript): transcript is PrototypeSession =>
  transcript.kind === 'prototype'
export const isPrototypeGrillingSession = (transcript: AnyTranscript): transcript is PrototypeGrillingSession =>
  transcript.kind === 'prototypeGrilling'

/** The Images a human message adds in the middle of a session whose folder holds them. */
export interface ConversationImages {
  /** Checks the Images against the session's limits and numbers them; changes nothing. */
  number: (uploads: ImageUpload[]) => Array<ValidImage & { number: number }>
  /** Puts them in the session's folder and storage, and returns what the message lists. */
  save: (numbered: Array<ValidImage & { number: number }>) => Promise<ImageRef[]>
}

/**
 * What differs between the kinds of session: where one runs, where its Transcript lives, how it is
 * announced, and what its submission means. The Supervisor runs all of them the same way.
 */
export interface Scope {
  /** The session's working directory — the only folder it may read. */
  cwd: string
  guardMode: GuardMode
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
  /** One turn, no human message after the start: a turn that ends without an accepted submission is a failure. */
  singleTurn?: boolean
  /**
   * Many rounds: an accepted submission ends Claude's turn, not the session, and the next message starts a new round.
   * A round whose submission was refused, or that was asked to write and did not, fails alone.
   */
  rounds?: boolean
  /** The Images the human adds mid-session, for a scope that keeps them in its folder. */
  conversationImages?: ConversationImages
  /** The line a stopped session ends with; the default says nothing was written. */
  stoppedNote?: string
  /** Called when the session has ended, just before its final state is saved: removes its working folder. */
  release?: () => Promise<void>
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
  /** The Images the human sent with the first message; only Grilling Sessions take them. */
  images?: ImageUpload[]
  /** Images the scope numbered and kept itself (a Prototype session); sent with the first message as they are. */
  numberedImages?: NumberedImage[]
  /**
   * Images of Prototypes given as context, already numbered after the session's own. Sent with the first message
   * only; they are not the human's Images, so nothing lists or stores them.
   */
  contextImages?: NumberedImage[]
  /** Undoes the preparation when the session never starts. */
  abandon?: () => Promise<void>
}

/** The Transcript without its messages: what lists and live-session lookups send to the browser. */
export const summaryOf = <T extends AnyTranscript>({ messages: _messages, ...summary }: T) => summary
