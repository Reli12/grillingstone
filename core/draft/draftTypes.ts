// The Draft: one work item being written, its Sections and Entries, and the Iteration Log.
// The human-edit markers (humanEdited / humanMoved / discarded) decide what becomes a Conflict (ADR-0005).
import type { Proposal } from '#core/proposal/proposalTypes.ts'
import type { AdoField } from '#core/shared/adoFields.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import type { Template, SectionShape } from '#core/template/templateTypes.ts'

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
  target: AdoField
  guidance: string
  entryFormat?: 'gherkin'
  /** Prose body; for an empty entries Section, the "N/A — reason" line. */
  body: string
  entries: Entry[]
  discarded: boolean
  humanEdited: boolean
  humanMoved: boolean
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
  template: Template
  sections: Section[]
  iterationLog: IterationLogLine[]
  proposal: Proposal | null
  createdAt: string
  updatedAt: string
}

/** Draft content as a session submits it for v1 — validated against the Template. */
export interface DraftContent {
  title: string
  sections: { key: string; body?: string; entries?: { title: string; body: string }[] }[]
}
