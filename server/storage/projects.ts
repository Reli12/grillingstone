// Projects: one folder each under data/projects/, holding project.json, its Drafts, Transcripts and Glossary.
// A Project's id is a slug of its name plus a short random part, so it is readable and never collides.
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Project, ProjectSummary } from '#core/contract/apiTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { type Tracker, TRACKER_LABELS, trackerOrDefault } from '#core/shared/tracker.ts'

import { Conflict, NotFound } from './errors.ts'
import { isSafeId, readJson, writeJson } from './fsUtil.ts'
import { draftsDir, projectDir, projectFile, projectsDir, transcriptsDir } from './paths.ts'

const MAX_SLUG_LENGTH = 40
const FALLBACK_SLUG = 'project'

/** Combining marks, i.e. the accents NFKD splits off: "ü" → "u" + mark. */
const COMBINING_MARKS = /\p{M}/gu
/** Each run of characters that cannot appear in a slug. */
const NON_SLUG_RUN = /[^a-z0-9]+/g
/** A dash at the very start or end. */
const EDGE_DASH = /^-|-$/g

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(NON_SLUG_RUN, '-')
    .replace(EDGE_DASH, '')
    .slice(0, MAX_SLUG_LENGTH) || FALLBACK_SLUG

/** A stored Project; one saved before Trackers existed is Azure DevOps. */
const withTracker = (project: Project): Project => ({ ...project, tracker: trackerOrDefault(project.tracker) })

/** How many Drafts a Project folder holds; a Project without a drafts folder simply has none. */
async function countDrafts(folderName: string) {
  // A missing drafts folder means no Drafts yet, which is a count of zero, not an error.
  const files = await fs.readdir(path.join(projectsDir, folderName, 'drafts')).catch(() => [])
  return files.filter((file) => file.endsWith('.json')).length
}

async function summaryOf(folderName: string): Promise<ProjectSummary | null> {
  const project = await readJson<Project>(path.join(projectsDir, folderName, 'project.json'))
  if (!project) return null
  return { ...withTracker(project), drafts: await countDrafts(folderName) }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  let names: string[]
  try {
    names = await fs.readdir(projectsDir)
  } catch {
    // No projects folder yet means no Projects; the first createProject makes it.
    return []
  }
  const projects = await Promise.all(names.filter(isSafeId).map(summaryOf))
  return projects
    .filter((project): project is ProjectSummary => project !== null)
    .sort((first, second) => first.name.localeCompare(second.name))
}

export async function getProject(projectId: string): Promise<Project> {
  const project = await readJson<Project>(projectFile(projectId))
  if (!project) throw new NotFound(`No Project ${projectId}`)
  return withTracker(project)
}

export async function createProject(name: string, tracker: Tracker, now: string): Promise<Project> {
  // newId('') is "-" followed by random characters; skip the dash and keep five of them.
  const suffix = newId('').slice(1, 6)
  const project: Project = { id: `${slug(name)}-${suffix}`, name: name.trim(), createdAt: now, tracker }
  await fs.mkdir(draftsDir(project.id), { recursive: true })
  await fs.mkdir(transcriptsDir(project.id), { recursive: true })
  await writeJson(projectFile(project.id), project)
  return project
}

/**
 * Renames a Project and/or changes its Tracker. The Tracker is fixed once the Project has a Draft, because
 * every Draft keeps a snapshot of a Template written for that Tracker.
 */
export async function updateProject(projectId: string, change: { name?: string; tracker?: Tracker }): Promise<Project> {
  const current = await getProject(projectId)
  const trackerChanges = change.tracker !== undefined && change.tracker !== current.tracker
  if (trackerChanges && (await countDrafts(projectId)) > 0)
    throw new Conflict(
      `"${current.name}" already has Drafts, so it stays ${TRACKER_LABELS[current.tracker]}. Create a new Project for the other Tracker; its Glossary can start as a copy of this one.`,
    )
  const project: Project = {
    ...current,
    ...(change.name !== undefined ? { name: change.name.trim() } : {}),
    ...(change.tracker !== undefined ? { tracker: change.tracker } : {}),
  }
  await writeJson(projectFile(projectId), project)
  return project
}

/** Deletes a Project's folder: its Drafts, Transcripts, Images and Glossary all go with it. */
export async function deleteProject(projectId: string) {
  await getProject(projectId)
  await fs.rm(projectDir(projectId), { recursive: true, force: true })
}

export const allProjectIds = async () => (await listProjects()).map((project) => project.id)
