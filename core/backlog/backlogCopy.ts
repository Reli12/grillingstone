// The Backlog Copy (ADR-0015): a Project's pasted copy of one Azure DevOps work item, identified by its ID.
// Re-pasting keeps what it replaced and raises the revision, which is what flags the Drafts referencing it.
import { lineChanges } from '#core/shared/lineDiff.ts'
import type { Reason } from '#core/shared/validation.ts'
import { isTrackerType, type WorkItemType } from '#core/shared/workItemType.ts'

export interface BacklogCopy {
  /** Derived from the work item ID ("ado-1234"), so one work item can exist only once in a Project. */
  id: string
  workItemId: number
  workItemType: WorkItemType
  title: string
  /** The link as the human pasted it, for "open in Azure DevOps"; absent when only the ID was pasted. */
  url?: string
  /** The work item's description, business rules included. */
  content: string
  acceptanceCriteria?: string
  /** What the last re-paste replaced; "what changed" compares against it. */
  previousContent?: string
  previousAcceptanceCriteria?: string
  /** 1 on create, +1 per re-paste that changed something. */
  revision: number
  pastedAt: string
  /** The Azure DevOps revision of the item its content was taken at, when known (Refresh, or a check at paste). */
  adoRev?: number
}

/** What the human pastes: the ID or link, the type, a title and the text. */
export interface PastedCopy {
  workItem: string
  workItemType: string
  title: string
  content: string
  acceptanceCriteria?: string
}

export type CreatedCopy = { ok: true; copy: BacklogCopy } | { ok: false; reasons: Reason[] }

export const backlogCopyId = (workItemId: number) => `ado-${workItemId}`

export type WorkItemIdParse = { ok: true; workItemId: number } | { ok: false; reason: string }

/** A bare ID, "#1234", or an Azure DevOps work item link (…/_workitems/edit/1234). */
const BARE_ID = /^#?(\d+)$/
const WORK_ITEM_URL = /\/_workitems\/edit\/(\d+)\/?(?:[?#].*)?$/i

export function parseWorkItemId(input: string): WorkItemIdParse {
  const text = input.trim()
  const digits = BARE_ID.exec(text)?.[1] ?? WORK_ITEM_URL.exec(text)?.[1]
  const workItemId = Number(digits)
  if (!digits || !Number.isSafeInteger(workItemId) || workItemId < 1)
    return { ok: false, reason: 'Enter the work item ID (1234 or #1234) or its Azure DevOps link.' }
  return { ok: true, workItemId }
}

const LINK = /^https?:\/\//i

/** Trimmed Acceptance Criteria, or nothing when they are blank. */
const criteria = (text: string | undefined) => (text?.trim() ? { acceptanceCriteria: text.trim() } : {})

export function createBacklogCopy(pasted: PastedCopy, now: string): CreatedCopy {
  const reasons: Reason[] = []
  const parsed = parseWorkItemId(pasted.workItem)
  if (!parsed.ok) reasons.push({ code: 'workItemId', message: parsed.reason })
  if (!isTrackerType('azure-devops', pasted.workItemType))
    reasons.push({
      code: 'workItemType',
      message: 'Choose an Azure DevOps Work Item Type: Epic, Feature, PBI, Task or Bug.',
    })
  const title = pasted.title.trim()
  if (!title) reasons.push({ code: 'title', message: 'Give the Backlog Copy a title.' })
  const content = pasted.content.trim()
  if (!content) reasons.push({ code: 'content', message: "Paste the work item's content." })
  if (!parsed.ok || reasons.length) return { ok: false, reasons }

  const link = pasted.workItem.trim()
  return {
    ok: true,
    copy: {
      id: backlogCopyId(parsed.workItemId),
      workItemId: parsed.workItemId,
      workItemType: pasted.workItemType as WorkItemType,
      title,
      ...(LINK.test(link) ? { url: link } : {}),
      content,
      ...criteria(pasted.acceptanceCriteria),
      revision: 1,
      pastedAt: now,
    },
  }
}

/** A re-paste: new text, and optionally a new title or type. */
export interface Repaste {
  content: string
  acceptanceCriteria?: string
  title?: string
  workItemType?: string
}

export type RepastedCopy = { ok: true; copy: BacklogCopy; changed: boolean } | { ok: false; reasons: Reason[] }

/**
 * The Copy with the new text. Only a change to the content or the Acceptance Criteria raises the revision and
 * keeps what was replaced; the same text again (after trimming) leaves it as it was.
 */
export function repasteBacklogCopy(copy: BacklogCopy, repaste: Repaste, now: string): RepastedCopy {
  const content = repaste.content.trim()
  if (!content) return { ok: false, reasons: [{ code: 'content', message: "Paste the work item's content." }] }
  const acceptanceCriteria = repaste.acceptanceCriteria?.trim() ?? ''
  const title = repaste.title?.trim() || copy.title
  const workItemType = isTrackerType('azure-devops', repaste.workItemType) ? repaste.workItemType : copy.workItemType

  const changed = content !== copy.content || acceptanceCriteria !== (copy.acceptanceCriteria ?? '')
  const renamed = title !== copy.title || workItemType !== copy.workItemType
  if (!changed && !renamed) return { ok: true, changed: false, copy }
  if (!changed) return { ok: true, changed: false, copy: { ...copy, title, workItemType } }

  const { acceptanceCriteria: replacedCriteria, previousAcceptanceCriteria: _older, ...rest } = copy
  return {
    ok: true,
    changed: true,
    copy: {
      ...rest,
      title,
      workItemType,
      content,
      ...criteria(acceptanceCriteria),
      previousContent: copy.content,
      ...(replacedCriteria ? { previousAcceptanceCriteria: replacedCriteria } : {}),
      revision: copy.revision + 1,
      pastedAt: now,
    },
  }
}

/** One heading and its "- removed" / "+ added" lines, or nothing when that part did not change. */
function changedPart(heading: string, before: string, after: string) {
  const changes = lineChanges(before, after)
  if (!changes.length) return ''
  const lines = changes.map((change) => `${change.kind === 'added' ? '+' : '-'} ${change.line}`)
  return [`${heading}:`, ...lines].join('\n')
}

/** What the last re-paste changed, as readable lines for a session; '' for a Copy never re-pasted. */
export function backlogCopyChanges(copy: BacklogCopy): string {
  if (copy.revision < 2 || copy.previousContent === undefined) return ''
  return [
    changedPart('Description', copy.previousContent, copy.content),
    changedPart('Acceptance Criteria', copy.previousAcceptanceCriteria ?? '', copy.acceptanceCriteria ?? ''),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** The heading a session and the readable file name a Copy by: "Feature #1234: Device archiving". */
export const backlogCopyHeading = (copy: BacklogCopy) => `${copy.workItemType} #${copy.workItemId}: ${copy.title}`

/** The readable rendering saved beside the JSON; it is what a session reads on demand. */
export function backlogCopyMarkdown(copy: BacklogCopy): string {
  return [
    `# ${backlogCopyHeading(copy)}`,
    '',
    ...(copy.url ? [`Azure DevOps: ${copy.url}`] : []),
    `Revision ${copy.revision}, pasted ${copy.pastedAt}`,
    '',
    '## Description',
    '',
    copy.content,
    ...(copy.acceptanceCriteria ? ['', '## Acceptance Criteria', '', copy.acceptanceCriteria] : []),
    '',
  ].join('\n')
}
