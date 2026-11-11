// Azure DevOps API: the Connection, a Project's Backlog and Default Tags, revision checks, Import, Publish, Unlink,
// Drift, a Draft's Parent, and Fetch and Refresh of Backlog Copies. The token goes in once, in the Connection card, and never
// comes back.
import type { ConnectionStatus, WorkItemView } from '#core/ado/adoTypes.ts'
import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import type { Project, RevisionCheck } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { DriftResult } from '#core/drift/drift.ts'
import type { PublishPlan } from '#core/publish/publishPlan.ts'
import type { SessionSummary } from '#core/session/sessionTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

/** The parent the plan was made with; absent when Publish adds none (an Epic, or the item already has one). */
export interface ParentChoice {
  workItemId: number | null
  title: string | null
  adoType: string | null
  /** Typed in the dialog rather than taken from the Draft's Parent. */
  typed: boolean
}

export interface PlanResult {
  plan: PublishPlan
  drift?: DriftResult
  defaultTags: string[]
  parent?: ParentChoice
  /** Whether the human may update an existing item instead of creating one: the Draft is not linked yet. */
  choosesTarget: boolean
}

/** What the human chose in the Publish dialog; blank or absent: the defaults (Draft's Parent, a new item). */
export interface PublishChoice {
  /** A work item ID or link to place the item under. */
  parent?: string
  /** For a Draft not linked yet: the ID or link of the existing item to update (and link) instead of creating one. */
  existing?: string
}

/** Only what was chosen, so a blank choice is not sent. */
const chosen = ({ parent, existing }: PublishChoice) => ({
  ...(parent ? { parent } : {}),
  ...(existing ? { existing } : {}),
})

export interface Published {
  draft: Draft
  workItemId: number
  url: string
  created: boolean
}

export interface WorkItemPreview {
  id: number
  adoType: string
  workItemType: WorkItemView['workItemType']
  title: string
  parentId: number | null
  url: string
  refusal?: string
  linkedDraftId?: string
}

export interface RefreshAll {
  refreshed: number
  changed: number
  failed: { copyId: string; reason: string }[]
}

/** A new Copy read from its item, or the existing Copy of that item Refreshed. */
export interface FetchedCopy {
  copy: BacklogCopy
  changed: boolean
  created: boolean
}

export const adoApi = {
  connection: () => api.get<ConnectionStatus>(endpoints.connection),
  saveConnection: (orgUrl: string, token: string) => api.put<ConnectionStatus>(endpoints.connection, { orgUrl, token }),
  disconnect: () => api.delete<ConnectionStatus>(endpoints.connection),

  setBacklog: (projectId: string, name: string) => api.put<Project>(endpoints.projectBacklog(projectId), { name }),
  clearBacklog: (projectId: string) => api.delete<Project>(endpoints.projectBacklog(projectId)),
  setDefaultTags: (projectId: string, tags: string[]) =>
    api.put<Project>(endpoints.projectDefaultTags(projectId), { tags }),
  revisions: (projectId: string) => api.get<RevisionCheck>(endpoints.projectRevisions(projectId)),

  lookup: (projectId: string, workItem: string) =>
    api.post<WorkItemPreview>(endpoints.workItemLookup(projectId), { workItem }),
  importDraft: (projectId: string, workItem: string, templateId: string) =>
    api.post<{ draft: Draft; session: SessionSummary }>(endpoints.importDraft(projectId), { workItem, templateId }),

  publishPlan: (projectId: string, draftId: string, choice: PublishChoice = {}) =>
    api.post<PlanResult>(endpoints.publishPlan(projectId, draftId), chosen(choice)),
  publish: (
    projectId: string,
    draftId: string,
    tags: string[],
    expectedRev: number | null,
    choice: PublishChoice = {},
  ) => api.post<Published>(endpoints.publish(projectId, draftId), { tags, expectedRev, ...chosen(choice) }),
  unlink: (projectId: string, draftId: string) => api.delete<Draft>(endpoints.draftLink(projectId, draftId)),
  driftCheck: (projectId: string, draftId: string) =>
    api.post<{ draft: Draft; drift: DriftResult }>(endpoints.driftCheck(projectId, draftId)),
  setParent: (projectId: string, draftId: string, copyId: string | null) =>
    api.patch<Draft>(endpoints.draftParent(projectId, draftId), { copyId }),

  refresh: (projectId: string, copyId: string) =>
    api.post<{ copy: BacklogCopy; changed: boolean }>(endpoints.refreshCopy(projectId, copyId)),
  refreshAll: (projectId: string) => api.post<RefreshAll>(endpoints.refreshAllCopies(projectId)),
  fetchCopy: (projectId: string, workItem: string) =>
    api.post<FetchedCopy>(endpoints.fetchCopy(projectId), { workItem }),
  importCopy: (projectId: string, copyId: string, templateId: string) =>
    api.post<{ draft: Draft; session: SessionSummary }>(endpoints.importCopy(projectId, copyId), { templateId }),
}
