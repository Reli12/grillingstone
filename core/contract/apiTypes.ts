// Shapes exchanged over the HTTP API that are not domain types themselves.
import type { Reason } from '#core/shared/validation.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

export interface DraftSummary {
  id: string
  projectId: string
  title: string
  requirement: string
  workItemType: WorkItemType
  version: number
  templateName: string
  pendingChanges: number
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  drafts: number
}

export interface GlossaryDoc {
  markdown: string
  /** Content hash; a save must name the version it edited (stale saves are refused, ADR-0003). */
  version: string
}

export interface Settings {
  /** Name used in Iteration Log lines (@author). */
  author: string
  /** Optional model alias for Grilling Sessions ('' = Claude Code's default). */
  model: string
  /** 'system' follows the OS appearance. */
  theme: Theme
}

export type Theme = 'system' | 'light' | 'dark'
export const THEMES: Theme[] = ['system', 'light', 'dark']

export interface ApiError {
  error: string
  reasons?: Reason[]
}

export interface Project {
  id: string
  name: string
  createdAt: string
}
