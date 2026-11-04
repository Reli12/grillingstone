// Shapes exchanged over the HTTP API that are not domain types themselves.
import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import type { CodeFolder } from '#core/codeFolder/codeFolderTypes.ts'
import type { Tracker } from '#core/shared/tracker.ts'
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
  /** Work item IDs of referenced Backlog Copies re-pasted since the Draft's last session. */
  changedBacklogCopies: number[]
  updatedAt: string
}

/** A Backlog Copy with the Drafts that reference it, as the Backlog Copies tab lists it. */
export interface BacklogCopySummary {
  copy: BacklogCopy
  drafts: { id: string; title: string; requirement: string; workItemType: WorkItemType; changed: boolean }[]
}

export interface ProjectSummary extends Project {
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
  /** Preselected when a new Project is created; never changes an existing Project. */
  defaultTracker: Tracker
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
  /** Fixed once the Project has its first Draft. */
  tracker: Tracker
  /** Folders of source code its Grilling Sessions may read; absent on Projects saved before Code Folders. */
  codeFolders?: CodeFolder[]
}
