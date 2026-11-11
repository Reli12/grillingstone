// Import and Refresh: Azure DevOps content coming into the tool on the human's request. Import creates a Draft born
// linked to an item of the Backlog and starts its Import Session; Refresh re-pastes a Backlog Copy from its item,
// through the very same path as a re-paste, so no Draft can tell the two apart; a fetched Copy is saved through the
// same path as a paste.
import type { WorkItemView } from '#core/ado/adoTypes.ts'
import { parseWorkItemAddress } from '#core/ado/workItemAddress.ts'
import { importedRequirement, mapWorkItem, toPastedCopy, toRepaste } from '#core/ado/workItemMapping.ts'
import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import { newDraft } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { publishedSnapshot } from '#core/publish/publishedSnapshot.ts'
import type { SessionSummary } from '#core/session/sessionTypes.ts'
import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import type { BacklogCopyService } from '../services/backlogCopyService.ts'
import { now } from '../services/clock.ts'
import type { DraftService } from '../services/draftService.ts'
import type { Supervisor } from '../sessions/supervisor.ts'
import { getBacklogCopy, listBacklogCopies, withBacklogLock, writeBacklogCopy } from '../storage/backlogCopies.ts'
import { getTemplate } from '../storage/templates.ts'
import { AdoRefusal } from './adoRefusal.ts'
import { adoProject } from './backlogService.ts'
import type { ConnectionService } from './connectionService.ts'
import { checkLinkable } from './publishService.ts'

/** What the human sees before importing: enough to confirm it is the right item. */
export interface WorkItemPreview {
  id: number
  adoType: string
  workItemType: WorkItemView['workItemType']
  title: string
  parentId: number | null
  url: string
  /** Why it cannot be imported, if it cannot. */
  refusal?: string
  /** The active Draft already linked to it, to open instead. */
  linkedDraftId?: string
}

export interface RefreshOutcome {
  copy: BacklogCopy
  changed: boolean
}

/** A fetch either saved a new Copy, or Refreshed the one the item already had. */
export interface FetchOutcome extends RefreshOutcome {
  created: boolean
}

export class ImportService {
  private drafts: DraftService
  private copies: BacklogCopyService
  private supervisor: Supervisor
  private connection: ConnectionService

  constructor(deps: {
    drafts: DraftService
    copies: BacklogCopyService
    supervisor: Supervisor
    connection: ConnectionService
  }) {
    this.drafts = deps.drafts
    this.copies = deps.copies
    this.supervisor = deps.supervisor
    this.connection = deps.connection
  }

  private async item(input: string): Promise<WorkItemView> {
    const parsed = parseWorkItemAddress(input, (await this.connection.organization()) ?? '')
    if (!parsed.ok) throw new AdoRefusal(parsed.reason)
    const client = await this.connection.client()
    return mapWorkItem(await client.getWorkItem(parsed.workItemId), client.organizationUrl)
  }

  /** The item named by its ID or link, and whether this Project can import it. */
  async lookup(projectId: string, input: string): Promise<WorkItemPreview> {
    const project = await adoProject(projectId)
    if (!project.backlog) throw new AdoRefusal('Choose this Project’s Backlog in its Settings first.')
    const item = await this.item(input)
    const preview = {
      id: item.id,
      adoType: item.adoType,
      workItemType: item.workItemType,
      title: item.title,
      parentId: item.parentId,
      url: item.url,
    }
    try {
      await checkLinkable(projectId, project.backlog, item)
      return preview
    } catch (error) {
      if (!(error instanceof AdoRefusal)) throw error
      return { ...preview, refusal: error.message, ...(error.draftId ? { linkedDraftId: error.draftId } : {}) }
    }
  }

  /**
   * A new Draft from the item, always read live: it takes the item's type, keeps everything it says as the
   * requirement, starts linked with a Published Snapshot, and its Import Session writes v1.
   */
  async importDraft(
    projectId: string,
    input: string,
    templateId: string,
  ): Promise<{ draft: Draft; session: SessionSummary }> {
    const project = await adoProject(projectId)
    if (!project.backlog) throw new AdoRefusal('Choose this Project’s Backlog in its Settings first.')
    const item = await this.item(input)
    await checkLinkable(projectId, project.backlog, item)
    const template = await getTemplate(templateId)
    if (templateTracker(template) !== 'azure-devops' || template.workItemType !== item.workItemType)
      throw new AdoRefusal(`Choose an Azure DevOps ${item.workItemType} Template: #${item.id} is a ${item.adoType}.`)
    const fresh = newDraft({
      projectId,
      workItemType: item.workItemType,
      template,
      requirement: importedRequirement(item, ADO_FIELD_LABELS),
      now: now(),
    })
    const draft = await this.drafts.createDraft({
      ...fresh,
      lane: 'grilling',
      linkedWorkItem: { id: item.id, url: item.url, workItemType: item.workItemType },
      publishedSnapshot: publishedSnapshot(fresh, item, now()),
    })
    const session = await this.supervisor.start({ projectId, draftId: draft.id, kind: 'import' })
    return { draft, session }
  }

  /** "Import as Draft" on a Backlog Copy: the live item, not the Copy. */
  async importCopy(projectId: string, copyId: string, templateId: string) {
    const copy = await getBacklogCopy(projectId, copyId)
    return this.importDraft(projectId, String(copy.workItemId), templateId)
  }

  /** Refreshes one Copy from its item: exactly a re-paste, plus the revision it was taken at. */
  async refresh(projectId: string, copyId: string): Promise<RefreshOutcome> {
    await adoProject(projectId)
    const copy = await getBacklogCopy(projectId, copyId)
    const client = await this.connection.client()
    const item = mapWorkItem(await client.getWorkItem(copy.workItemId), client.organizationUrl)
    const before = copy.revision
    const repasted = await this.copies.repaste(projectId, copyId, toRepaste(item))
    const tagged = await withBacklogLock(projectId, async () => {
      const current = await getBacklogCopy(projectId, copyId)
      if (current.adoRev === item.rev) return current
      const next = { ...current, adoRev: item.rev }
      await writeBacklogCopy(projectId, next)
      return next
    })
    return { copy: { ...repasted, adoRev: tagged.adoRev }, changed: repasted.revision !== before }
  }

  /**
   * A Backlog Copy read live from the item named by its ID or link, instead of pasted by hand. It is saved through
   * the same path as a paste, with the revision it was taken at. An item that is already a Copy is Refreshed instead.
   */
  async fetchCopy(projectId: string, input: string): Promise<FetchOutcome> {
    await adoProject(projectId)
    const item = await this.item(input)
    const existing = (await listBacklogCopies(projectId)).find((copy) => copy.workItemId === item.id)
    if (existing) return { ...(await this.refresh(projectId, existing.id)), created: false }
    if (!item.workItemType)
      throw new AdoRefusal(
        `#${item.id} is a ${item.adoType}; a Backlog Copy can only be an Epic, Feature, PBI, Task or Bug.`,
      )
    const created = await this.copies.create(projectId, toPastedCopy(item))
    const copy = await withBacklogLock(projectId, async () => {
      const next = { ...(await getBacklogCopy(projectId, created.id)), adoRev: item.rev }
      await writeBacklogCopy(projectId, next)
      return next
    })
    return { copy, changed: true, created: true }
  }

  /** Refreshes every Copy of the Project, one after another; a Copy whose item cannot be read is reported. */
  async refreshAll(
    projectId: string,
  ): Promise<{ refreshed: number; changed: number; failed: { copyId: string; reason: string }[] }> {
    await adoProject(projectId)
    const result = { refreshed: 0, changed: 0, failed: [] as { copyId: string; reason: string }[] }
    for (const copy of await listBacklogCopies(projectId)) {
      try {
        const outcome = await this.refresh(projectId, copy.id)
        result.refreshed += 1
        if (outcome.changed) result.changed += 1
      } catch (error) {
        result.failed.push({ copyId: copy.id, reason: error instanceof Error ? error.message : 'failed' })
      }
    }
    return result
  }

  /** Records the item's revision on a freshly pasted Copy, so "changed since your copy" can show later. Best effort. */
  async noteRevision(projectId: string, copyId: string) {
    try {
      if ((await this.connection.state()) !== 'connected') return
      const copy = await getBacklogCopy(projectId, copyId)
      const client = await this.connection.client()
      const rev = (await client.getRevisions([copy.workItemId])).get(copy.workItemId)
      if (rev === undefined) return
      await withBacklogLock(projectId, async () => {
        const current = await getBacklogCopy(projectId, copyId)
        if (current.adoRev === undefined) await writeBacklogCopy(projectId, { ...current, adoRev: rev })
      })
    } catch {
      // The item may be out of the token's reach: the Copy then simply shows no "changed" hint.
    }
  }
}
