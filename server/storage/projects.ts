import fs from 'node:fs/promises'
import path from 'node:path'

import type { Project, ProjectSummary } from '#core/contract/apiTypes.ts'
import { newId } from '#core/shared/ids.ts'

import { NotFound } from './errors.ts'
import { isSafeId, readJson, writeJson } from './fsUtil.ts'
import { draftsDir, projectFile, projectsDir, transcriptsDir } from './paths.ts'

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // accents split off by NFKD: "ü" → "u"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'project'

export async function listProjects(): Promise<ProjectSummary[]> {
  let names: string[]
  try {
    names = await fs.readdir(projectsDir)
  } catch {
    return []
  }
  const projects = await Promise.all(
    names.filter(isSafeId).map(async (n) => {
      const p = await readJson<Project>(path.join(projectsDir, n, 'project.json'))
      if (!p) return null
      const drafts = (await fs.readdir(path.join(projectsDir, n, 'drafts')).catch(() => [])).filter((f) =>
        f.endsWith('.json'),
      ).length
      return { ...p, drafts }
    }),
  )
  return projects.filter((p): p is ProjectSummary => p !== null).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getProject(projectId: string): Promise<Project> {
  const p = await readJson<Project>(projectFile(projectId))
  if (!p) throw new NotFound(`No Project ${projectId}`)
  return p
}

export async function createProject(name: string, now: string): Promise<Project> {
  const project: Project = { id: `${slug(name)}-${newId('').slice(1, 6)}`, name: name.trim(), createdAt: now }
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

export const allProjectIds = async () => (await listProjects()).map((p) => p.id)
