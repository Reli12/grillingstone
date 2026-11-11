// Publish Plan: exactly what a Publish will write to Azure DevOps, or every reason it cannot happen yet. The Publish
// dialog shows this plan and the service sends it as it is, so what the human confirms is what is written.
import { adoTypeName, type ConnectionState, type WorkItemView } from '#core/ado/adoTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { copyFields } from '#core/publish/copyFields.ts'
import { sameContent, sameTitle } from '#core/publish/publishedSnapshot.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import type { Reason } from '#core/shared/validation.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

/** Types that must end up with a parent; an Epic never has one and a Bug may go without. */
const NEEDS_PARENT: WorkItemType[] = ['Feature', 'PBI', 'Task']

export interface PublishInput {
  draft: Draft
  connection: ConnectionState
  /** The Project's Backlog. */
  backlog: string | undefined
  /** The tags for a new item: the dialog's, prefilled from the Project's Default Tags. */
  tags: string[]
  /** The Linked Work Item as Azure DevOps holds it now; null when the Draft has none, or it no longer exists. */
  linked: WorkItemView | null
  /**
   * The Draft's Parent: its work item ID and the item, null when Azure DevOps has no such item. The one the human
   * typed in the dialog when they typed one, otherwise the Backlog Reference marked as Parent.
   */
  parent: { workItemId: number; item: WorkItemView | null } | null
  /** Why the parent the human typed in the dialog is not a work item ID or link; absent when it is (or none typed). */
  parentError?: string
  /** Why the existing item the human chose to update cannot be this Draft's; absent when it can (or none chosen). */
  existingError?: string
}

/** Whether the human may choose the parent Publish adds: not for an Epic, nor for an item that already has one. */
export const choosesParent = (type: WorkItemType, linked: WorkItemView | null): boolean =>
  type !== 'Epic' && !linked?.parentId

export interface PlannedField {
  /** Azure DevOps reference name. */
  field: string
  label: string
  /** What is written: plain text for the title, HTML for every other field. */
  value: string
  /** For an update: what the item holds now. */
  before?: string
}

interface PlanBase {
  workItemType: WorkItemType
  adoType: string
  title: string
  /** The parent link Publish adds; null when it adds none. */
  addParent: number | null
}

export interface CreatePlan extends PlanBase {
  mode: 'create'
  backlog: string
  /** Every field written, title first. */
  fields: PlannedField[]
  areaPath: string
  iterationPath: string
  tags: string[]
}

export interface UpdatePlan extends PlanBase {
  mode: 'update'
  workItemId: number
  url: string
  /** The parent the item already has, which Publish keeps; null when it has none. */
  parentId: number | null
  /** Only the fields that change, with what they hold now. */
  fields: PlannedField[]
  /** The item's revision the plan was made from; the write is refused if it changed meanwhile. */
  expectedRev: number
  /** Labels of fields someone changed in Azure DevOps since the last Publish that this Publish writes over. */
  overwrites: string[]
}

export type PublishPlan = { ok: false; reasons: Reason[] } | ({ ok: true } & (CreatePlan | UpdatePlan))

const reason = (code: string, message: string): Reason => ({ code, message })

/** Why the Draft cannot be Published right now, whatever Azure DevOps holds. */
function draftReasons({ draft, connection, backlog }: PublishInput): Reason[] {
  const reasons: Reason[] = []
  if (templateTracker(draft.template) !== 'azure-devops')
    reasons.push(reason('tracker', 'Only Drafts of an Azure DevOps Project are Published.'))
  if (connection === 'none')
    reasons.push(reason('connection', 'Set up the Connection to Azure DevOps in Settings first.'))
  if (connection === 'rejected')
    reasons.push(reason('rejected', 'Token rejected — it may have expired or been revoked. Replace it in Settings.'))
  if (!backlog) reasons.push(reason('backlog', 'Choose this Project’s Backlog in its Settings first.'))
  if (draft.archived) reasons.push(reason('archived', 'An Archived Draft is not Published. Restore it first.'))
  if (draft.version === 0) reasons.push(reason('notWritten', 'There is nothing to Publish before v1 is written.'))
  if (draft.proposal?.kind === 'drift' && draft.proposal.changes.some((change) => change.status === 'pending'))
    reasons.push(
      reason('drift', 'Triage the changes brought in from Azure DevOps first, so none is overwritten unseen.'),
    )
  return reasons
}

/** The parent link to add, or why the item would end up without the parent it needs. */
function parentPlan(input: PublishInput): { addParent: number | null; reasons: Reason[] } {
  const type = input.draft.workItemType
  if (!choosesParent(type, input.linked)) return { addParent: null, reasons: [] }
  if (input.parentError) return { addParent: null, reasons: [reason('parentInvalid', input.parentError)] }
  if (input.parent?.item) return { addParent: input.parent.workItemId, reasons: [] }
  if (input.parent)
    return {
      addParent: null,
      reasons: [
        reason(
          'parentNotFound',
          `The Parent #${input.parent.workItemId} does not exist in Azure DevOps — Publish it first, or enter another Parent.`,
        ),
      ],
    }
  if (NEEDS_PARENT.includes(type))
    return {
      addParent: null,
      reasons: [
        reason(
          'parentMissing',
          `A ${type} needs a parent: enter its ID or link under Parent, or mark one of its Backlog References as its Parent.`,
        ),
      ],
    }
  return { addParent: null, reasons: [] }
}

/** The Publish Renderer's output, title first, exactly as "Copy for Azure DevOps" shows it. */
function plannedFields(draft: Draft): PlannedField[] {
  return copyFields(draft).fields.map((field) => ({
    field: field.field,
    label: field.label,
    value: field.html ?? field.text,
  }))
}

function createPlan(input: PublishInput, addParent: number | null, backlog: string): CreatePlan {
  const parent = input.parent?.item
  // A new item sits where its parent's team sees it; without a parent (or one in another project), at the root.
  const areaPath = addParent && parent?.teamProject === backlog ? parent.areaPath : backlog
  return {
    mode: 'create',
    workItemType: input.draft.workItemType,
    adoType: adoTypeName(input.draft.workItemType),
    title: input.draft.title,
    addParent,
    backlog,
    fields: plannedFields(input.draft),
    areaPath,
    iterationPath: backlog,
    tags: cleanTags(input.tags),
  }
}

function updatePlan(input: PublishInput, linked: WorkItemView, addParent: number | null): UpdatePlan {
  const snapshot = input.draft.publishedSnapshot
  const current = (field: string) => (field === ADO_FIELDS.title ? linked.title : (linked.fields[field] ?? ''))
  const same = (field: string, first: string, second: string) =>
    field === ADO_FIELDS.title ? sameTitle(first, second) : sameContent(first, second)
  const changed = plannedFields(input.draft).filter(
    (planned) => !same(planned.field, planned.value, current(planned.field)),
  )
  const fields = changed.map((planned) => ({ ...planned, before: current(planned.field) }))
  // Changed in Azure DevOps since the last Publish, and about to be written over.
  const snapshotValue = (field: string) => (field === ADO_FIELDS.title ? snapshot?.title : snapshot?.fields[field])
  const overwrites = snapshot
    ? fields
        .filter((planned) => {
          const before = snapshotValue(planned.field)
          return before !== undefined && !same(planned.field, before, current(planned.field))
        })
        .map((planned) => planned.label)
    : []
  return {
    mode: 'update',
    workItemType: input.draft.workItemType,
    adoType: linked.adoType,
    title: input.draft.title,
    addParent,
    workItemId: linked.id,
    url: linked.url,
    parentId: linked.parentId,
    fields,
    expectedRev: linked.rev,
    overwrites,
  }
}

/** Trimmed, without blanks or case-insensitive repeats; ";" separates tags in Azure DevOps, so it splits one. */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>()
  return tags
    .flatMap((tag) => tag.split(';'))
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase()
      if (!tag || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function publishPlan(input: PublishInput): PublishPlan {
  const reasons = draftReasons(input)
  if (input.existingError) reasons.push(reason('existingInvalid', input.existingError))
  const linkedMissing = input.draft.linkedWorkItem && !input.linked
  if (linkedMissing)
    reasons.push(
      reason(
        'linkedNotFound',
        `The Linked Work Item #${input.draft.linkedWorkItem!.id} no longer exists in Azure DevOps. Unlink it to Publish a new one.`,
      ),
    )
  if (input.linked && input.linked.workItemType !== input.draft.workItemType)
    reasons.push(reason('type', `#${input.linked.id} is a ${input.linked.adoType}, not a ${input.draft.workItemType}.`))
  const parent = parentPlan(input)
  reasons.push(...parent.reasons)
  if (reasons.length || !input.backlog) return { ok: false, reasons }
  const plan = input.linked
    ? updatePlan(input, input.linked, parent.addParent)
    : createPlan(input, parent.addParent, input.backlog)
  return { ok: true, ...plan }
}

/** One JSON Patch operation of the Azure DevOps work item API. */
export interface PatchOperation {
  op: 'add' | 'replace' | 'test'
  path: string
  value: unknown
}

const setField = (field: string, value: unknown): PatchOperation => ({ op: 'add', path: `/fields/${field}`, value })

/** The plan as the JSON Patch Azure DevOps takes; `orgUrl` names the parent in the link it adds. */
export function publishOperations(plan: CreatePlan | UpdatePlan, orgUrl: string): PatchOperation[] {
  const ops: PatchOperation[] =
    plan.mode === 'update'
      ? [{ op: 'test', path: '/rev', value: plan.expectedRev }, ...plan.fields.map((f) => setField(f.field, f.value))]
      : [
          ...plan.fields.map((f) => setField(f.field, f.value)),
          setField('System.AreaPath', plan.areaPath),
          setField('System.IterationPath', plan.iterationPath),
          ...(plan.tags.length ? [setField('System.Tags', plan.tags.join('; '))] : []),
        ]
  if (plan.addParent)
    ops.push({
      op: 'add',
      path: '/relations/-',
      value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${orgUrl}/_apis/wit/workItems/${plan.addParent}` },
    })
  return ops
}
