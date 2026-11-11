// The Draft: one work item being written, its Sections and Entries, and the Iteration Log.
// The human-edit markers (humanEdited / humanMoved / discarded) decide what becomes a Conflict (ADR-0005).
import type { DriftSeen, LinkedWorkItem, PublishedSnapshot } from '#core/ado/adoTypes.ts'
import type { DraftLane } from '#core/draft/draftLane.ts'
import type { Proposal } from '#core/proposal/proposalTypes.ts'
import type { SectionTarget } from '#core/shared/trackerFields.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import type { SectionShape, Template } from '#core/template/templateTypes.ts'

export interface Entry {
  id: string
  title: string
  body: string
  discarded: boolean
  humanEdited: boolean
  humanMoved: boolean
}

export interface Section {
  id: string
  key: string
  heading: string
  shape: SectionShape
  locked: boolean
  target: SectionTarget
  guidance: string
  entryFormat?: 'gherkin'
  /** Prose body; for an empty entries Section, the "N/A — reason" line. */
  body: string
  entries: Entry[]
  discarded: boolean
  humanEdited: boolean
  humanMoved: boolean
}

/** A Draft's link to one Backlog Copy, with the Copy's revision its last session received. */
export interface BacklogReference {
  copyId: string
  seenRevision: number
  /** The Draft's Parent: the work item Publish places the Linked Work Item under. At most one per Draft. */
  parent?: boolean
}

export interface IterationLogLine {
  version: number
  date: string
  author: string
  note: string
}

export interface Draft {
  id: string
  projectId: string
  workItemType: WorkItemType
  title: string
  titleHumanEdited: boolean
  /** 0 until v1 is written. */
  version: number
  requirement: string
  references: string[]
  /** Backlog Copies this Draft derives from (ADR-0015). Absent on Drafts saved before they existed: none. */
  backlogReferences?: BacklogReference[]
  template: Template
  sections: Section[]
  iterationLog: IterationLogLine[]
  proposal: Proposal | null
  /** Its Lane on the Project board (ADR-0019). Absent on Drafts saved before Lanes: derived, see laneOf. */
  lane?: DraftLane
  /** Archived: no longer worked on, off the board until restored. Absent: not Archived. */
  archived?: boolean
  /** The Azure DevOps work item this Draft Publishes to; absent until it is Published, Imported or linked. */
  linkedWorkItem?: LinkedWorkItem
  /** What Azure DevOps held at the last Publish or link: the baseline of Drift. */
  publishedSnapshot?: PublishedSnapshot
  /** The Azure DevOps state whose Drift was last brought in as a Proposal; cleared by the next Publish. */
  driftSeen?: DriftSeen
  createdAt: string
  updatedAt: string
}

/** Draft content as a session submits it for v1 — validated against the Template. */
export interface DraftContent {
  title: string
  sections: { key: string; body?: string; entries?: { title: string; body: string }[] }[]
}
