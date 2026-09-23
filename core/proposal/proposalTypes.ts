// A Proposal: the changes a later session submits instead of rewriting the Draft (ADR-0005).
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { Template } from '#core/template/templateTypes.ts'

export type ChangeKind = 'retitle' | 'replaceSection' | 'replaceEntry' | 'addEntry' | 'restore' | 'addSection'
export type ChangeStatus = 'pending' | 'accepted' | 'rejected'

/** What a session submits for one change; targets refer to ids in the current Draft. */
export interface ProposedChange {
  kind: ChangeKind
  /** Short human-readable description, e.g. "Scope · move bulk archive in". */
  label?: string
  sectionId?: string
  entryId?: string
  /** For addEntry: insert after this Entry (default: append). */
  afterEntryId?: string
  /** For addSection: the Template Section key being added. */
  sectionKey?: string
  title?: string
  body?: string
  entries?: { title: string; body: string }[]
}

export interface Change extends ProposedChange {
  id: string
  label: string
  /** Current content, when the change replaces something (for a Conflict: the human's version). */
  before?: string
  /** What Claude proposes, as display text. */
  after: string
  conflict: boolean
  conflictReason?: string
  status: ChangeStatus
}

export interface Proposal {
  id: string
  sessionId: string
  kind: SessionKind
  createdAt: string
  changes: Change[]
  /** Set by a template-upgrade session: the Template version the Draft moves to. */
  upgradeTo?: Template
}
