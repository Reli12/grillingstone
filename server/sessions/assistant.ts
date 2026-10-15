// The Assistant seam (ADR-0020): how the Supervisor runs a session's conversation without knowing whether
// Claude Code or Codex holds it. Each adapter turns its own process and protocol into the same steps.
import type { AssistantName } from '#core/session/assistantName.ts'
import type { Seed } from '#core/session/cardProtocol.ts'

import type { Scope } from './sessionScope.ts'
import type { StreamStep } from './streamEvents.ts'

/** Whether the Assistant keeps the conversation so it can be continued, and which one to continue (ADR-0014). */
export interface Conversation {
  persist: boolean
  resume?: string
}

export interface AssistantLaunch {
  sessionId: string
  /** Authenticates the submit script's call back to the backend. */
  token: string
  scope: Pick<Scope, 'cwd' | 'guardMode' | 'submitLabel'>
  seed: Seed
  /** '' for the Assistant's own default. */
  model: string
  conversation: Conversation
}

/** How a session's Assistant ended: it could not start at all, or its process ended (cleanly or not). */
export type AssistantExit =
  | { type: 'spawnFailed'; error: string }
  /** `error` explains the exit, for when the session had not finished and so counts it as a crash. */
  | { type: 'exited'; error: string }

export interface AssistantEvents {
  /** One step of the conversation, in the order the Assistant produced them. */
  onStep: (step: StreamStep) => void
  /** Called once, after every step. */
  onExit: (exit: AssistantExit) => void
}

/** One running conversation. */
export interface AssistantSession {
  /** Sends one human turn. */
  send: (text: string) => void
  /** No more turns follow; the Assistant ends once its current turn is done. */
  close: () => void
  /** Asks the Assistant to end now, and forces it if it is still running after a grace period. */
  stop: () => void
}

export interface Assistant {
  name: AssistantName
  start: (launch: AssistantLaunch, events: AssistantEvents) => AssistantSession
}
