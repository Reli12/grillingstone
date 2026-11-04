// Everything that changes a Draft goes through here, so every change is saved under the Draft's lock and
// announced to the browser the same way — whether it came from the UI or from a session's submission.
import { type BacklogCopy, createBacklogCopy, type PastedCopy } from '#core/backlog/backlogCopy.ts'
import { withBacklogReferences } from '#core/backlog/backlogReference.ts'
import type { Project } from '#core/contract/apiTypes.ts'
import { newDraft } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import { applyHumanEdit } from '#core/proposal/humanEdit.ts'
import { acceptAllClean, decide } from '#core/proposal/triage.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import type { Hub } from '../hub.ts'
import { insertBacklogCopy, listBacklogCopies, withBacklogLock } from '../storage/backlogCopies.ts'
import * as drafts from '../storage/drafts.ts'
import { getProject } from '../storage/projects.ts'
import { getTemplate } from '../storage/templates.ts'
import { iterationMeta, now } from './clock.ts'

export class DraftInputError extends Error {}

export interface NewDraftInput {
  workItemType: WorkItemType
  templateId: string
  requirement: string
  references: string[]
  /** Existing Backlog Copies to reference (ADR-0015). */
  backlogReferences?: string[]
  /** Backlog Copies pasted in the new-Draft form, created and referenced in the same request. */
  newBacklogCopies?: PastedCopy[]
}

/** Backlog Copies exist only for Azure DevOps Projects. */
export function requireAzureDevOps(project: Project) {
  if (project.tracker !== 'azure-devops')
    throw new DraftInputError('Backlog Copies exist only in Azure DevOps Projects.')
}

/** The pasted Copies, validated; any refusal refuses them all, so nothing is half-created. */
function validatedCopies(pasted: PastedCopy[], existing: BacklogCopy[], now: string): BacklogCopy[] {
  const taken = new Set(existing.map((copy) => copy.id))
  return pasted.map((item) => {
    const result = createBacklogCopy(item, now)
    if (!result.ok) throw new DraftInputError(result.reasons.map((reason) => reason.message).join(' '))
    if (taken.has(result.copy.id))
      throw new DraftInputError(
        `Work item #${result.copy.workItemId} is already a Backlog Copy in this Project — pick it instead of pasting it again.`,
      )
    taken.add(result.copy.id)
    return result.copy
  })
}

export class DraftService {
  private hub: Hub

  constructor(hub: Hub) {
    this.hub = hub
  }

  async create(projectId: string, input: NewDraftInput): Promise<Draft> {
    const template = await getTemplate(input.templateId)
    if (template.workItemType !== input.workItemType)
      throw new DraftInputError(`"${template.name}" is not a ${input.workItemType} Template.`)
    // The type is the Template's, so a Template of the Project's Tracker also brings a type that Tracker defines.
    const project = await getProject(projectId)
    if (templateTracker(template) !== project.tracker)
      throw new DraftInputError(`"${template.name}" is not a ${TRACKER_LABELS[project.tracker]} Template.`)
    const requirement = input.requirement.trim()
    const references = await this.existingReferences(projectId, input.references)
    const draft = await this.withBacklog(project, input, (backlogCopies, backlogIds) => {
      // With a Backlog Reference the first session can start from the referenced item and ask what this Draft covers.
      if (!requirement && !backlogIds.length)
        throw new DraftInputError('Describe the requirement so Claude has something to grill.')
      const fresh = newDraft({
        projectId,
        workItemType: input.workItemType,
        template,
        requirement,
        references,
        now: now(),
      })
      return drafts.createDraft(withBacklogReferences(fresh, backlogIds, backlogCopies))
    })
    this.hub.broadcast({ type: 'drafts', projectId })
    return draft
  }

  /**
   * Runs `create` with the Project's Backlog Copies and the ids the new Draft references: the existing ones it
   * names (unknown ones are refused) and the pasted ones, which are saved only once `create` succeeded.
   */
  private async withBacklog(
    project: Project,
    input: NewDraftInput,
    create: (copies: BacklogCopy[], ids: string[]) => Promise<Draft>,
  ): Promise<Draft> {
    const named = input.backlogReferences ?? []
    const pasted = input.newBacklogCopies ?? []
    if (!named.length && !pasted.length) return create([], [])
    requireAzureDevOps(project)
    return withBacklogLock(project.id, async () => {
      const existing = await listBacklogCopies(project.id)
      const unknown = named.filter((id) => !existing.some((copy) => copy.id === id))
      if (unknown.length) throw new DraftInputError(`No Backlog Copy ${unknown.join(', ')} in this Project.`)
      const fresh = validatedCopies(pasted, existing, now())
      const all = [...existing, ...fresh]
      const draft = await create(all, [...named, ...fresh.map((copy) => copy.id)])
      for (const copy of fresh) await insertBacklogCopy(project.id, copy)
      if (fresh.length) this.hub.broadcast({ type: 'backlogCopies', projectId: project.id })
      return draft
    })
  }

  /** Sets which Backlog Copies the Draft references; unknown ones are dropped, new ones start unchanged. */
  async setBacklogReferences(projectId: string, draftId: string, copyIds: string[]) {
    requireAzureDevOps(await getProject(projectId))
    const copies = await listBacklogCopies(projectId)
    return this.update(projectId, draftId, (draft) => withBacklogReferences(draft, copyIds, copies))
  }

  async setReferences(projectId: string, draftId: string, references: string[]) {
    const existing = await this.existingReferences(projectId, references)
    // A Draft cannot be its own Reference.
    const refs = existing.filter((referenceId) => referenceId !== draftId)
    return this.update(projectId, draftId, (draft) => ({ ...draft, references: refs }))
  }

  edit = (projectId: string, draftId: string, op: HumanOp) =>
    this.update(projectId, draftId, (draft) => applyHumanEdit(draft, op))

  async decide(projectId: string, draftId: string, changeId: string, accept: boolean) {
    const meta = await iterationMeta()
    return this.update(projectId, draftId, (draft) => decide(draft, changeId, accept, meta))
  }

  async acceptAllClean(projectId: string, draftId: string) {
    const meta = await iterationMeta()
    return this.update(projectId, draftId, (draft) => acceptAllClean(draft, meta))
  }

  /** Saves `fn`'s result under the Draft's lock and announces it; returning null (or the same Draft) changes nothing. */
  async update(projectId: string, draftId: string, fn: (draft: Draft) => Draft | null): Promise<Draft> {
    let changed = false
    const draft = await drafts.updateDraft(projectId, draftId, (current) => {
      const next = fn(current)
      changed = next !== null && next !== current
      return next
    })
    if (changed) {
      this.hub.broadcast({ type: 'draft', projectId, draft })
      this.hub.broadcast({ type: 'drafts', projectId })
    }
    return draft
  }

  async delete(projectId: string, draftId: string) {
    await drafts.deleteDraft(projectId, draftId)
    this.hub.broadcast({ type: 'drafts', projectId })
  }

  /** Only Drafts that exist in the Project can be References. */
  private async existingReferences(projectId: string, ids: string[]) {
    const existing = new Set((await drafts.listDrafts(projectId)).map((draft) => draft.id))
    return ids.filter((id) => existing.has(id))
  }
}
