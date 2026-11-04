// Backlog Copies (ADR-0015): paste, re-paste and delete a Project's copies of Azure DevOps work items. A re-paste
// flags every Draft referencing the Copy (derived from revisions, nothing stored on the Drafts); deleting a Copy
// removes the references to it from every Draft, inside the same lock.
import {
  type BacklogCopy,
  createBacklogCopy,
  type PastedCopy,
  type Repaste,
  repasteBacklogCopy,
} from '#core/backlog/backlogCopy.ts'
import { backlogReferencesOf, changedBacklogCopies, removeBacklogReference } from '#core/backlog/backlogReference.ts'
import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'

import type { Hub } from '../hub.ts'
import {
  getBacklogCopy,
  insertBacklogCopy,
  listBacklogCopies,
  removeBacklogCopy,
  withBacklogLock,
  writeBacklogCopy,
} from '../storage/backlogCopies.ts'
import { listDrafts } from '../storage/drafts.ts'
import { getProject } from '../storage/projects.ts'
import { now } from './clock.ts'
import { DraftInputError, type DraftService, requireAzureDevOps } from './draftService.ts'

const references = (draft: Draft, copyId: string) =>
  backlogReferencesOf(draft).some((reference) => reference.copyId === copyId)

export class BacklogCopyService {
  private hub: Hub
  private drafts: DraftService

  constructor(hub: Hub, drafts: DraftService) {
    this.hub = hub
    this.drafts = drafts
  }

  /** Every Copy of the Project with the Drafts referencing it, and whether each Draft is behind it. */
  async list(projectId: string): Promise<BacklogCopySummary[]> {
    requireAzureDevOps(await getProject(projectId))
    const [copies, drafts] = await Promise.all([listBacklogCopies(projectId), listDrafts(projectId)])
    return copies.map((copy) => ({
      copy,
      drafts: drafts
        .filter((draft) => references(draft, copy.id))
        .map((draft) => ({
          id: draft.id,
          title: draft.title,
          requirement: draft.requirement,
          workItemType: draft.workItemType,
          changed: changedBacklogCopies(draft, [copy]).length > 0,
        })),
    }))
  }

  async create(projectId: string, pasted: PastedCopy): Promise<BacklogCopy> {
    requireAzureDevOps(await getProject(projectId))
    const result = createBacklogCopy(pasted, now())
    if (!result.ok) throw new DraftInputError(result.reasons.map((reason) => reason.message).join(' '))
    await withBacklogLock(projectId, () => insertBacklogCopy(projectId, result.copy))
    this.hub.broadcast({ type: 'backlogCopies', projectId })
    return result.copy
  }

  /** New text for a Copy. Changed text flags the Drafts referencing it; the same text changes nothing. */
  async repaste(projectId: string, copyId: string, repaste: Repaste): Promise<BacklogCopy> {
    requireAzureDevOps(await getProject(projectId))
    const outcome = await withBacklogLock(projectId, async () => {
      const current = await getBacklogCopy(projectId, copyId)
      const result = repasteBacklogCopy(current, repaste, now())
      if (!result.ok) throw new DraftInputError(result.reasons.map((reason) => reason.message).join(' '))
      if (result.copy !== current) await writeBacklogCopy(projectId, result.copy)
      return { ...result, touched: result.copy !== current }
    })
    if (outcome.touched) this.hub.broadcast({ type: 'backlogCopies', projectId })
    // The changed flag shows in the Draft list, so it is refreshed too.
    if (outcome.changed) this.hub.broadcast({ type: 'drafts', projectId })
    return outcome.copy
  }

  /** Deletes a Copy and the references to it from every Draft, in one locked operation. */
  async delete(projectId: string, copyId: string) {
    requireAzureDevOps(await getProject(projectId))
    await withBacklogLock(projectId, async () => {
      await getBacklogCopy(projectId, copyId)
      const referencing = (await listDrafts(projectId)).filter((draft) => references(draft, copyId))
      for (const draft of referencing)
        await this.drafts.update(projectId, draft.id, (current) => removeBacklogReference(current, copyId))
      await removeBacklogCopy(projectId, copyId)
    })
    this.hub.broadcast({ type: 'backlogCopies', projectId })
    this.hub.broadcast({ type: 'drafts', projectId })
  }
}
