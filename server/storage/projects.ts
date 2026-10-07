// Projects: one folder each under data/projects/, holding project.json, its Drafts, Transcripts and Glossary.
// A Project's id is a slug of its name plus a short random part, so it is readable and never collides.
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Project, ProjectSummary } from '#core/contract/apiTypes.ts'
import { newId } from '#core/shared/ids.ts'

import { NotFound } from './errors.ts'
import { isSafeId, readJson, writeJson } from './fsUtil.ts'
import { draftsDir, projectFile, projectsDir, transcriptsDir } from './paths.ts'

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

/** How many Drafts a Project folder holds; a Project without a drafts folder simply has none. */
async function countDrafts(folderName: string) {
  // A missing drafts folder means no Drafts yet, which is a count of zero, not an error.
  const files = await fs.readdir(path.join(projectsDir, folderName, 'drafts')).catch(() => [])
  return files.filter((file) => file.endsWith('.json')).length
}

async function summaryOf(folderName: string): Promise<ProjectSummary | null> {
  const project = await readJson<Project>(path.join(projectsDir, folderName, 'project.json'))
  if (!project) return null
  return { ...project, drafts: await countDrafts(folderName) }
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
  return project
}

export async function createProject(name: string, now: string): Promise<Project> {
  // newId('') is "-" followed by random characters; skip the dash and keep five of them.
  const suffix = newId('').slice(1, 6)
  const project: Project = { id: `${slug(name)}-${suffix}`, name: name.trim(), createdAt: now }
  await fs.mkdir(draftsDir(project.id), { recursive: true })
  await fs.mkdir(transcriptsDir(project.id), { recursive: true })
  await writeJson(projectFile(project.id), project)
  return project
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  const project = { ...(await getProject(projectId)), name: name.trim() }
  await writeJson(projectFile(projectId), project)
  return project
}

export const allProjectIds = async () => (await listProjects()).map((project) => project.id)
