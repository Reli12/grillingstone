// Drafts: JSON is the source of truth, with a readable markdown rendering regenerated on every save (ADR-0004).
import fs from 'node:fs/promises'

import type { BacklogCopy } from '#core/backlog/backlogCopy.ts'
import { changedBacklogCopies } from '#core/backlog/backlogReference.ts'
import type { DraftSummary } from '#core/contract/apiTypes.ts'
import { laneOf } from '#core/draft/draftLane.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { draftMarkdown } from '#core/publish/draftMarkdown.ts'

import { NotFound } from './errors.ts'
import { KeyedLock, listJson, readJson, writeFileAtomic, writeJson } from './fsUtil.ts'
import { draftFile, draftsDir } from './paths.ts'
import { getProject } from './projects.ts'
import { deleteTranscriptsOf } from './transcripts.ts'

const lock = new KeyedLock()

export async function getDraft(projectId: string, draftId: string): Promise<Draft> {
  const draft = await readJson<Draft>(draftFile(projectId, draftId, 'json'))
  if (!draft) throw new NotFound(`No Draft ${draftId}`)
  return draft
}

async function write(draft: Draft) {
  await writeJson(draftFile(draft.projectId, draft.id, 'json'), draft)
  await writeFileAtomic(draftFile(draft.projectId, draft.id, 'md'), draftMarkdown(draft))
}

export async function createDraft(draft: Draft): Promise<Draft> {
  await getProject(draft.projectId)
  await write(draft)
  return draft
}

/**
 * Read-modify-write under a per-Draft lock. Returning null (or the same Draft) from `fn` means "no change".
 * `touch: false` keeps `updatedAt`, for changes to where a Draft sits rather than to what it says.
 */
export function updateDraft(
  projectId: string,
  draftId: string,
  fn: (draft: Draft) => Draft | null | Promise<Draft | null>,
  { touch = true }: { touch?: boolean } = {},
): Promise<Draft> {
  return lock.run(`${projectId}/${draftId}`, async () => {
    const current = await getDraft(projectId, draftId)
    const next = await fn(current)
    if (!next || next === current) return current
    const saved = touch ? { ...next, updatedAt: new Date().toISOString() } : next
    await write(saved)
    return saved
  })
}

export async function deleteDraft(projectId: string, draftId: string) {
  await lock.run(`${projectId}/${draftId}`, async () => {
    await getDraft(projectId, draftId)
    await fs.rm(draftFile(projectId, draftId, 'json'))
    await fs.rm(draftFile(projectId, draftId, 'md'), { force: true })
    // Its Transcripts and their Images go too, so nothing deleted keeps using disk space.
    await deleteTranscriptsOf(projectId, draftId)
  })
}

export async function listDrafts(projectId: string): Promise<Draft[]> {
  await getProject(projectId)
  const drafts = await listJson<Draft>(draftsDir(projectId))
  return drafts.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

/** A Draft for lists; `copies` are the Project's Backlog Copies, for the changed-Copy flag. */
export function summarize(draft: Draft, copies: BacklogCopy[] = []): DraftSummary {
  const changed = changedBacklogCopies(draft, copies).map((copy) => copy.workItemId)
  return {
    id: draft.id,
    projectId: draft.projectId,
    title: draft.title,
    requirement: draft.requirement,
    workItemType: draft.workItemType,
    version: draft.version,
    templateName: draft.template.name,
    pendingChanges: draft.proposal?.changes.filter((change) => change.status === 'pending').length ?? 0,
    changedBacklogCopies: changed,
    lane: laneOf(draft, changed.length > 0),
    archived: draft.archived ?? false,
    updatedAt: draft.updatedAt,
    ...(draft.linkedWorkItem ? { linkedWorkItem: { id: draft.linkedWorkItem.id, url: draft.linkedWorkItem.url } } : {}),
  }
}
