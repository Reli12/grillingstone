// Azure DevOps as the tool sees it: the Connection's state, a work item reduced to what the tool uses, and what a
// Draft keeps about its Linked Work Item. Pure types and the Work Item Type names, no I/O.
import type { WorkItemType } from '#core/shared/workItemType.ts'

/** Azure DevOps names the PBI "Product Backlog Item"; every other type keeps its name. */
export const ADO_TYPE_NAMES: Record<string, string> = {
  Epic: 'Epic',
  Feature: 'Feature',
  PBI: 'Product Backlog Item',
  Task: 'Task',
  Bug: 'Bug',
}

/** Every type a Backlog must have: the Scrum process's. */
export const REQUIRED_ADO_TYPES = Object.values(ADO_TYPE_NAMES)

export const adoTypeName = (type: WorkItemType): string => ADO_TYPE_NAMES[type] ?? type

/** The tool's type for an Azure DevOps type name; null for a type the tool does not write (Test Case, Impediment…). */
export function toolTypeOf(adoType: string): WorkItemType | null {
  const found = Object.entries(ADO_TYPE_NAMES).find(([, name]) => name.toLowerCase() === adoType.trim().toLowerCase())
  return found ? (found[0] as WorkItemType) : null
}

/** One work item, reduced to what Publish, Import, Refresh and Drift use. */
export interface WorkItemView {
  id: number
  rev: number
  /** As Azure DevOps names it ("Product Backlog Item"). */
  adoType: string
  /** null for a type the tool does not write. */
  workItemType: WorkItemType | null
  title: string
  /** The rich-text fields a Section can be Published into that the item has, as Azure DevOps holds them (HTML). */
  fields: Record<string, string>
  parentId: number | null
  /** The Azure DevOps project it lives in. */
  teamProject: string
  areaPath: string
  iterationPath: string
  state: string
  tags: string[]
  /** Its page in Azure DevOps. */
  url: string
  /** The rich-text fields Azure DevOps holds as Markdown rather than HTML; absent when it said none. */
  markdownFields?: string[]
}

/** A Draft's Linked Work Item. */
export interface LinkedWorkItem {
  id: number
  url: string
  workItemType: WorkItemType
}

/** One Section of the Draft as it was Published (or linked): what Drift measures the human's own changes against. */
export interface SnapshotSection {
  id: string
  key: string
  heading: string
  target: string
  body: string
  entries: { id: string; title: string; body: string }[]
}

/**
 * What Azure DevOps held for the Linked Work Item at the last Publish or link, with its revision, and the Draft as it
 * was at that moment. The baseline a Drift Check compares against.
 */
export interface PublishedSnapshot {
  rev: number
  at: string
  title: string
  /** The Template's target fields as Azure DevOps held them (HTML); a field the item lacks is ''. */
  fields: Record<string, string>
  /** The Draft's non-Discarded content at that moment. */
  draft: { title: string; sections: SnapshotSection[] }
}

/** The Azure DevOps state whose Drift was last brought into the Draft as a Proposal; cleared by the next Publish. */
export interface DriftSeen {
  rev: number
  title: string
  fields: Record<string, string>
}

export type ConnectionState = 'none' | 'connected' | 'rejected'

/** What the browser learns about the Connection — never the token. */
export interface ConnectionStatus {
  state: ConnectionState
  /** https://dev.azure.com/{organization} */
  orgUrl?: string
  organization?: string
  /** Who the token acts as. */
  user?: string
  /** The token comes from GRILLINGSTONE_ADO_PAT: the card cannot change it. */
  fromEnvironment: boolean
  /** Where a saved token is kept on this machine, in words. */
  storage: string
  checkedAt?: string
}
