import { startingGlossary } from '#core/glossary/glossary.ts'

import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { glossaryBody, newProjectBody, projectNameBody } from '../http/schemas.ts'
import { now } from '../services/clock.ts'
import { getGlossary, startGlossary } from '../storage/glossary.ts'
import { createProject, getProject, listProjects, renameProject } from '../storage/projects.ts'
import type { AppDeps } from './deps.ts'

export function projectRoutes(r: Router, { glossary }: AppDeps) {
  r.get('/api/projects', () => listProjects())
  r.post('/api/projects', async ({ body }) => {
    const { name, glossary: text = '' } = parse(newProjectBody, body)
    const project = await createProject(name, now())
    const start = startingGlossary(name, text)
    if (start) await startGlossary(project.id, start)
    return project
  })
  r.get('/api/projects/:projectId', ({ params }) => getProject(params.projectId))
  r.patch('/api/projects/:projectId', ({ params, body }) =>
    renameProject(params.projectId, parse(projectNameBody, body).name),
  )

  r.get('/api/projects/:projectId/glossary', ({ params }) => getGlossary(params.projectId))
  r.put('/api/projects/:projectId/glossary', ({ params, body }) => {
    const { markdown, baseVersion } = parse(glossaryBody, body)
    return glossary.save(params.projectId, markdown, baseVersion)
  })
}
