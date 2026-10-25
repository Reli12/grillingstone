// What the backend tells the browser about Grilling and Template Sessions, and what a Transcript holds.
import type { Draft } from '#core/draft/draftTypes.ts'
import type { Segment } from '#core/session/blockExtractor.ts'
import type { ImageRef } from '#core/session/images.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { Tracker } from '#core/shared/tracker.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

export type SessionStatus =
  | 'starting'
  /** Claude is working on a reply. */
  | 'thinking'
  /** Claude finished its turn; the human's move. */
  | 'waiting'
  /** The human confirmed; Claude is writing and submitting. */
  | 'writing'
  | 'finished'
  | 'stopped'
  | 'failed'
  /** The backend restarted while the session ran. */
  | 'interrupted'

export const LIVE_STATUSES: SessionStatus[] = ['starting', 'thinking', 'waiting', 'writing']

export type ChatMessage =
  | {
      id: string
      at: string
      role: 'human'
      text: string
      kind: 'answer' | 'message' | 'write'
      /** The Images sent with this message; absent in Transcripts from before Images existed. */
      images?: ImageRef[]
    }
  | { id: string; at: string; role: 'claude'; segments: Segment[] }
  | {
      id: string
      at: string
      role: 'tool'
      tool: string
      summary: string
      outcome?: 'ok' | 'denied' | 'error'
      toolUseId?: string
    }
  | { id: string; at: string; role: 'system'; text: string; tone?: 'info' | 'success' | 'error' }

/** What every session has, whatever it writes. */
export interface SessionBase {
  id: string
  kind: SessionKind | 'template'
  status: SessionStatus
  focus?: { sectionId: string; entryId?: string; heading: string }
  humanNote?: string
  /** True once the human confirmed the write ("Write it now"). */
  writeConfirmed: boolean
  startedAt: string
  endedAt?: string
  error?: string
  /** Claude Code's own id for the conversation, from its init event; what a Continuation resumes (ADR-0014). */
  claudeSessionId?: string
}

/** A Grilling Session: on one Draft in one Project. */
export interface SessionSummary extends SessionBase {
  kind: SessionKind
  projectId: string
  draftId: string
  /** The ended session this one continues. */
  continues?: string
  /** The number of the last Image of this Transcript, so a Continuation numbers after it. */
  lastImageNumber?: number
}

export interface Transcript extends SessionSummary {
  messages: ChatMessage[]
}

/** What the human asked for on the New Template start step. */
export interface TemplateRequest {
  /** Absent on Template Sessions from before Trackers existed, which were Azure DevOps. */
  tracker?: Tracker
  workItemType: WorkItemType
  purpose: string
  examples: string
  baseTemplateId?: string
  baseTemplateName?: string
}

/** A Template Session: no Project, no Draft; ends with at most one new Template. */
export interface TemplateSessionSummary extends SessionBase {
  kind: 'template'
  request: TemplateRequest
  /** The Template it created, once accepted. */
  templateId?: string
}

export interface TemplateTranscript extends TemplateSessionSummary {
  messages: ChatMessage[]
}

/**
 * A Prototype Session (ADR-0023): on one Draft in one Project; ends with at most one Prototype. It has no Transcript
 * in the UI, so a summary is all the browser gets.
 */
export interface PrototypeSessionSummary {
  id: string
  kind: 'prototype'
  projectId: string
  draftId: string
  /** The Draft version the Prototype is built from, as the Draft stood when the session started. */
  draftVersion: number
  status: SessionStatus
  startedAt: string
  endedAt?: string
  error?: string
  /** The earlier Prototype this session starts from. */
  startingPrototypeId?: string
  /** The Prototype it wrote, once accepted. */
  prototypeId?: string
}

/** Server → browser over the websocket. */
export type ServerEvent =
  | { type: 'draft'; projectId: string; draft: Draft }
  | { type: 'session'; projectId: string; session: SessionSummary }
  | { type: 'message'; projectId: string; draftId: string; sessionId: string; message: ChatMessage }
  | { type: 'glossary'; projectId: string }
  | { type: 'drafts'; projectId: string }
  | { type: 'templates' }
  | { type: 'templateSession'; session: TemplateSessionSummary }
  | { type: 'templateMessage'; sessionId: string; message: ChatMessage }
  /** A Prototype Session started, changed status or ended. */
  | { type: 'prototypeSession'; projectId: string; session: PrototypeSessionSummary }
  /** A Project's Prototypes or Prototype rows changed; the lists refetch. */
  | { type: 'prototypes'; projectId: string }
