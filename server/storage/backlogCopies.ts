// Backlog Copies (ADR-0015): one JSON file per Copy as the source of truth, with a readable markdown rendering
// regenerated on every save — the file a session reads when a Copy is only listed.
import fs from 'node:fs/promises'

import { type BacklogCopy, backlogCopyMarkdown } from '#core/backlog/backlogCopy.ts'

import { Conflict, NotFound } from './errors.ts'
import { KeyedLock, listJson, readJson, writeFileAtomic, writeJson } from './fsUtil.ts'
import { backlogCopiesDir, backlogCopyFile } from './paths.ts'
import { getProject } from './projects.ts'

/** One lock per Project: creating, re-pasting and deleting its Copies never interleave. */
const lock = new KeyedLock()
export const withBacklogLock = <T>(projectId: string, fn: () => Promise<T>) => lock.run(projectId, fn)

export async function findBacklogCopy(projectId: string, copyId: string): Promise<BacklogCopy | null> {
  return readJson<BacklogCopy>(backlogCopyFile(projectId, copyId, 'json'))
}

export async function getBacklogCopy(projectId: string, copyId: string): Promise<BacklogCopy> {
  const copy = await findBacklogCopy(projectId, copyId)
  if (!copy) throw new NotFound(`No Backlog Copy ${copyId}`)
  return copy
}

/** The Project's Copies, by work item ID. */
export async function listBacklogCopies(projectId: string): Promise<BacklogCopy[]> {
  await getProject(projectId)
  const copies = await listJson<BacklogCopy>(backlogCopiesDir(projectId))
  return copies.sort((first, second) => first.workItemId - second.workItemId)
}

/** Writes the JSON and regenerates the markdown. Call inside withBacklogLock. */
export async function writeBacklogCopy(projectId: string, copy: BacklogCopy) {
  await writeJson(backlogCopyFile(projectId, copy.id, 'json'), copy)
  await writeFileAtomic(backlogCopyFile(projectId, copy.id, 'md'), backlogCopyMarkdown(copy))
}

/** Saves a new Copy; a work item already copied into the Project is refused. Call inside withBacklogLock. */
export async function insertBacklogCopy(projectId: string, copy: BacklogCopy) {
  if (await findBacklogCopy(projectId, copy.id))
    throw new Conflict(`Work item #${copy.workItemId} is already a Backlog Copy in this Project — re-paste it instead.`)
  await writeBacklogCopy(projectId, copy)
}

/** Removes a Copy's files. Call inside withBacklogLock. */
export async function removeBacklogCopy(projectId: string, copyId: string) {
  await fs.rm(backlogCopyFile(projectId, copyId, 'json'))
  await fs.rm(backlogCopyFile(projectId, copyId, 'md'), { force: true })
}
