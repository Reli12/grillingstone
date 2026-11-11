// Shapes exchanged over the HTTP API that are not domain types themselves.
import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import type { CodeFolder } from '#core/codeFolder/codeFolderTypes.ts'
import type { DraftLane } from '#core/draft/draftLane.ts'
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
  /** Its Lane on the Project board, derived for Drafts saved before Lanes (ADR-0019). */
  lane: DraftLane
  archived: boolean
  updatedAt: string
  /** The Azure DevOps work item it Publishes to, if any. */
  linkedWorkItem?: { id: number; url: string }
}

/** What a revision check found for a Project: possible Drift per Draft, newer items per Backlog Copy. */
export interface RevisionCheck {
  /** Draft ids whose Linked Work Item has a newer revision than the Draft knows. */
  mayHaveDrift: string[]
  /** Backlog Copy id → { the revision the Copy was taken at, the item's revision now }, for changed items only. */
  changedCopies: Record<string, { from: number; to: number }>
  /** The check could not reach Azure DevOps (no Connection, token rejected…); nothing above is known. */
  unavailable?: string
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
  /** Azure DevOps only: the Azure DevOps project it Publishes into, in Azure DevOps' own spelling. */
  backlog?: string
  /** Azure DevOps only: the tags Publish offers for each work item it creates. */
  defaultTags?: string[]
}
