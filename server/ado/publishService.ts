// Publish, Unlink and Drift for one Draft, and the cheap revision checks for a Project. Publish happens only here and
// only on the human's request: the plan the dialog shows is rebuilt and checked against what the human confirmed,
// then sent as it is. A Draft not linked yet either creates a new item or updates an existing one the human names,
// which links it. Every Publish replaces the Published Snapshot with what Azure DevOps holds afterwards.
import type { WorkItemView } from '#core/ado/adoTypes.ts'
import { parseWorkItemAddress } from '#core/ado/workItemAddress.ts'
import { mapWorkItem } from '#core/ado/workItemMapping.ts'
import { parentWorkItemId } from '#core/backlog/backlogReference.ts'
import type { RevisionCheck } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { bringInDrift, detectDrift, type DriftResult, mayHaveDrift } from '#core/drift/drift.ts'
import { publishedSnapshot } from '#core/publish/publishedSnapshot.ts'
import { choosesParent, publishOperations, type PublishPlan, publishPlan } from '#core/publish/publishPlan.ts'

import { now } from '../services/clock.ts'
import type { DraftService } from '../services/draftService.ts'
import { listBacklogCopies } from '../storage/backlogCopies.ts'
import { getDraft, listDrafts } from '../storage/drafts.ts'
import { type AdoClient, AdoNotFound, ChangedMeanwhile } from './adoClient.ts'
import { AdoRefusal } from './adoRefusal.ts'
import { adoProject } from './backlogService.ts'
import type { ConnectionService } from './connectionService.ts'

export interface PlanResult {
  plan: PublishPlan
  /** What a Drift Check run before this plan brought in; absent when none ran. */
  drift?: DriftResult
  /** The Project's Default Tags, which the dialog prefills. */
  defaultTags: string[]
  /** The parent Publish would add, which the dialog lets the human change; absent when it adds none (Epic, or the item has one). */
  parent?: ParentChoice
  /** Whether the human may choose to update an existing item instead of creating one: the Draft is not linked yet. */
  choosesTarget: boolean
}

/** The parent the plan was made with: the one typed in the dialog, else the Backlog Reference marked as Parent. */
export interface ParentChoice {
  /** null when there is none, or what was typed is not a work item ID or link. */
  workItemId: number | null
  /** As Azure DevOps holds it; null when it was not found (or there is no Connection). */
  title: string | null
  adoType: string | null
  /** Typed in the dialog rather than taken from the Draft's Parent. */
  typed: boolean
}

/** What the human may send with a plan or a Publish. */
export interface PlanOptions {
  /** Absent: the Project's Default Tags. */
  tags?: string[]
  /** A work item ID or link typed in the dialog; absent or blank: the Draft's Parent. */
  parent?: string
  /**
   * For a Draft not linked yet: the existing work item (ID or link) to update instead of creating one. Publishing
   * links the Draft to it. Absent or blank: create a new item.
   */
  existing?: string
}

export interface Published {
  draft: Draft
  workItemId: number
  url: string
  created: boolean
}

/** The item, or null when Azure DevOps has no such item. */
async function itemOrNull(client: AdoClient, id: number): Promise<WorkItemView | null> {
  try {
    return mapWorkItem(await client.getWorkItem(id), client.organizationUrl)
  } catch (error) {
    if (error instanceof AdoNotFound) return null
    throw error
  }
}

const sameProject = (first: string, second: string | undefined) => first.toLowerCase() === second?.toLowerCase()

/** The active Draft (not Archived) already linked to the item, other than `except`. */
async function draftLinkedTo(projectId: string, workItemId: number, except?: string) {
  return (await listDrafts(projectId)).find(
    (draft) => draft.id !== except && !draft.archived && draft.linkedWorkItem?.id === workItemId,
  )
}

/** Refuses an item the Draft cannot link to: outside the Backlog, another type, or already another Draft's. */
export async function checkLinkable(
  projectId: string,
  backlog: string,
  item: WorkItemView,
  opts: { workItemType?: Draft['workItemType']; except?: string } = {},
) {
  if (!sameProject(item.teamProject, backlog))
    throw new AdoRefusal(
      `#${item.id} is in ${item.teamProject}, not in this Project’s Backlog ${backlog}. To work from it, add it as a Backlog Copy instead.`,
    )
  if (!item.workItemType) throw new AdoRefusal(`#${item.id} is a ${item.adoType}, which the tool does not write.`)
  if (opts.workItemType && item.workItemType !== opts.workItemType)
    throw new AdoRefusal(`#${item.id} is a ${item.adoType}, but this Draft is a ${opts.workItemType}.`)
  const other = await draftLinkedTo(projectId, item.id, opts.except)
  if (other)
    throw new AdoRefusal(
      `#${item.id} is already linked to the Draft “${other.title || other.requirement.slice(0, 60)}”.`,
      other.id,
    )
}

export class PublishService {
  private drafts: DraftService
  private connection: ConnectionService

  constructor(drafts: DraftService, connection: ConnectionService) {
    this.drafts = drafts
    this.connection = connection
  }

  /** A client, or null when there is no Connection or its token is rejected (the plan then says why). */
  private async clientOrNull(): Promise<AdoClient | null> {
    return (await this.connection.state()) === 'connected' ? this.connection.client() : null
  }

  /**
   * Runs a Drift Check against `linked` when Azure DevOps changed anything since the Draft last knew: Drift arrives
   * as a Proposal (and moves the Draft to Needs you). Refused while another Proposal is open.
   */
  private async checkDrift(projectId: string, draft: Draft, linked: WorkItemView) {
    const found = detectDrift(draft, linked)
    if (!found.changes.length && !found.notes.length && !mayHaveDrift(draft, linked.rev)) return { draft, drift: found }
    if (found.changes.length && draft.proposal)
      throw new AdoRefusal('Azure DevOps changed this work item. Triage the open Proposal first, then check for Drift.')
    let drift = found
    const next = await this.drafts.update(
      projectId,
      draft.id,
      (current) => {
        const result = bringInDrift(current, linked, now())
        drift = result.drift
        return result.draft
      },
      { touch: false },
    )
    return { draft: next, drift }
  }

  /** The existing item the human chose for a Draft not linked yet, or why the Draft cannot be Published to it. */
  private async existingItem(
    projectId: string,
    draft: Draft,
    backlog: string | undefined,
    typed: string,
    client: AdoClient | null,
  ): Promise<{ item: WorkItemView } | { error: string } | null> {
    const parsed = parseWorkItemAddress(typed, (await this.connection.organization()) ?? '')
    if (!parsed.ok) return { error: parsed.reason }
    // Without a Connection or a Backlog the plan is blocked anyway, and says why.
    if (!client || !backlog) return null
    const item = await itemOrNull(client, parsed.workItemId)
    if (!item) return { error: `#${parsed.workItemId} does not exist in Azure DevOps.` }
    try {
      await checkLinkable(projectId, backlog, item, { workItemType: draft.workItemType, except: draft.id })
    } catch (error) {
      if (error instanceof AdoRefusal) return { error: error.message }
      throw error
    }
    return { item }
  }

  /** What a Publish of the Draft would write now, or why it cannot. Runs a Drift Check first for an update. */
  async plan(projectId: string, draftId: string, opts: PlanOptions = {}): Promise<PlanResult> {
    const project = await adoProject(projectId)
    let draft = await getDraft(projectId, draftId)
    const client = await this.clientOrNull()
    let linked = client && draft.linkedWorkItem ? await itemOrNull(client, draft.linkedWorkItem.id) : null
    const choosesTarget = !draft.linkedWorkItem && !draft.archived
    const target = choosesTarget ? opts.existing?.trim() : undefined
    const existing = target ? await this.existingItem(projectId, draft, project.backlog, target, client) : null
    if (existing && 'item' in existing) linked = existing.item
    let drift: DriftResult | undefined
    if (linked && draft.publishedSnapshot && !draft.archived) {
      const checked = await this.checkDrift(projectId, draft, linked)
      draft = checked.draft
      drift = checked.drift
    }
    const typed = opts.parent?.trim()
    let parentId: number | null = null
    let parentError: string | undefined
    if (typed) {
      const parsed = parseWorkItemAddress(typed, (await this.connection.organization()) ?? '')
      if (parsed.ok) parentId = parsed.workItemId
      else parentError = parsed.reason
    } else parentId = parentWorkItemId(draft, await listBacklogCopies(projectId))
    const parentItem = client && parentId ? await itemOrNull(client, parentId) : null
    const defaultTags = project.defaultTags ?? []
    const plan = publishPlan({
      draft,
      connection: await this.connection.state(),
      backlog: project.backlog,
      tags: opts.tags ?? defaultTags,
      linked,
      parent: parentId ? { workItemId: parentId, item: parentItem } : null,
      ...(parentError ? { parentError } : {}),
      ...(existing && 'error' in existing ? { existingError: existing.error } : {}),
    })
    const parent: ParentChoice | undefined = choosesParent(draft.workItemType, linked)
      ? { workItemId: parentId, title: parentItem?.title ?? null, adoType: parentItem?.adoType ?? null, typed: !!typed }
      : undefined
    return { plan, defaultTags, choosesTarget, ...(parent ? { parent } : {}), ...(drift ? { drift } : {}) }
  }

  /** Publishes the Draft as planned; refused when the plan is blocked or the item changed since the human saw it. */
  async publish(
    projectId: string,
    draftId: string,
    opts: { tags: string[]; expectedRev: number | null; parent?: string; existing?: string },
  ) {
    const { tags, parent, existing } = opts
    const { plan } = await this.plan(projectId, draftId, { tags, parent, existing })
    if (!plan.ok) throw new AdoRefusal(plan.reasons)
    const planned = plan.mode === 'update' ? plan.expectedRev : null
    if (planned !== opts.expectedRev) throw new ChangedMeanwhile()
    const client = await this.connection.client()
    const draft = await getDraft(projectId, draftId)
    const ops = publishOperations(plan, client.organizationUrl)
    let id: number
    if (plan.mode === 'create') id = (await client.createWorkItem(plan.backlog, plan.adoType, ops)).id
    else {
      id = plan.workItemId
      // Only the revision test: nothing changes, so nothing is written.
      if (ops.length > 1) await client.updateWorkItem(id, ops)
    }
    const item = await itemOrNull(client, id)
    if (!item) throw new AdoRefusal(`#${id} could not be read back from Azure DevOps.`)
    const saved = await this.drafts.update(
      projectId,
      draftId,
      (current) => {
        const { driftSeen: _seen, ...rest } = current
        return {
          ...rest,
          linkedWorkItem: { id: item.id, url: item.url, workItemType: draft.workItemType },
          publishedSnapshot: publishedSnapshot(draft, item, now()),
        }
      },
      { touch: false },
    )
    return { draft: saved, workItemId: item.id, url: item.url, created: plan.mode === 'create' } satisfies Published
  }

  /** Unlinking never touches Azure DevOps. */
  async unlink(projectId: string, draftId: string): Promise<Draft> {
    await adoProject(projectId)
    return this.drafts.update(projectId, draftId, (current) => {
      if (!current.linkedWorkItem) return null
      const { linkedWorkItem: _item, publishedSnapshot: _snapshot, driftSeen: _seen, ...rest } = current
      return rest
    })
  }

  /** On demand: brings what Azure DevOps changed into the Draft as a Proposal; reports what it could not place. */
  async driftCheck(projectId: string, draftId: string): Promise<{ draft: Draft; drift: DriftResult }> {
    await adoProject(projectId)
    const draft = await getDraft(projectId, draftId)
    if (!draft.linkedWorkItem || !draft.publishedSnapshot) throw new AdoRefusal('This Draft has no Linked Work Item.')
    const client = await this.connection.client()
    const linked = await itemOrNull(client, draft.linkedWorkItem.id)
    if (!linked) throw new AdoRefusal(`#${draft.linkedWorkItem.id} no longer exists in Azure DevOps.`)
    return this.checkDrift(projectId, draft, linked)
  }

  /** Which Drafts may have Drift and which Backlog Copies' items changed: one cheap call for the whole Project. */
  async revisions(projectId: string): Promise<RevisionCheck> {
    await adoProject(projectId)
    let client: AdoClient
    try {
      client = await this.connection.client()
    } catch (error) {
      return { mayHaveDrift: [], changedCopies: {}, unavailable: (error as Error).message }
    }
    const drafts = (await listDrafts(projectId)).filter((draft) => draft.linkedWorkItem && !draft.archived)
    const copies = await listBacklogCopies(projectId)
    const ids = [
      ...new Set([...drafts.map((draft) => draft.linkedWorkItem!.id), ...copies.map((copy) => copy.workItemId)]),
    ]
    const revisions = ids.length ? await client.getRevisions(ids) : new Map<number, number>()
    const changedCopies: RevisionCheck['changedCopies'] = {}
    for (const copy of copies) {
      const rev = revisions.get(copy.workItemId)
      if (rev !== undefined && copy.adoRev !== undefined && rev > copy.adoRev)
        changedCopies[copy.id] = { from: copy.adoRev, to: rev }
    }
    return {
      mayHaveDrift: drafts
        .filter((draft) => {
          const rev = revisions.get(draft.linkedWorkItem!.id)
          return rev !== undefined && mayHaveDrift(draft, rev)
        })
        .map((draft) => draft.id),
      changedCopies,
    }
  }
}
