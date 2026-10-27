// Everything that changes a Draft goes through here, so every change is saved under the Draft's lock and
// announced to the browser the same way — whether it came from the UI or from a session's submission.
import { newDraft } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import { applyHumanEdit } from '#core/proposal/humanEdit.ts'
import { acceptAllClean, decide } from '#core/proposal/triage.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import type { Hub } from '../hub.ts'
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
    if (!requirement) throw new DraftInputError('Describe the requirement so Claude has something to grill.')
    const references = await this.existingReferences(projectId, input.references)
    const draft = await drafts.createDraft(
      newDraft({ projectId, workItemType: input.workItemType, template, requirement, references, now: now() }),
    )
    this.hub.broadcast({ type: 'drafts', projectId })
    return draft
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
    // The Draft's Prototypes and session records went with it.
    this.hub.broadcast({ type: 'prototypes', projectId })
  }

  /** Only Drafts that exist in the Project can be References. */
  private async existingReferences(projectId: string, ids: string[]) {
    const existing = new Set((await drafts.listDrafts(projectId)).map((draft) => draft.id))
    return ids.filter((id) => existing.has(id))
  }
}
