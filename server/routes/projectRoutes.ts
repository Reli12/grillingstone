// Project routes: list, create (optionally seeding the Glossary), rename or change the Tracker, and read or
// save the Glossary.
import { startingGlossary } from '#core/glossary/glossary.ts'

import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { glossaryBody, newProjectBody, projectUpdateBody } from '../http/schemas.ts'
import { now } from '../services/clock.ts'
import { getGlossary, startGlossary } from '../storage/glossary.ts'
import { createProject, getProject, listProjects, updateProject } from '../storage/projects.ts'
import { getSettings } from '../storage/settings.ts'
import type { AppDeps } from './deps.ts'

export function projectRoutes(router: Router, { glossary }: AppDeps) {
  router.get('/api/projects', () => listProjects())
  router.post('/api/projects', async ({ body }) => {
    const { name, glossary: text = '', tracker } = parse(newProjectBody, body)
    const project = await createProject(name, tracker ?? (await getSettings()).defaultTracker, now())
    const start = startingGlossary(name, text)
    if (start) await startGlossary(project.id, start)
    return project
  })
  router.get('/api/projects/:projectId', ({ params }) => getProject(params.projectId))
  router.patch('/api/projects/:projectId', ({ params, body }) =>
    updateProject(params.projectId, parse(projectUpdateBody, body)),
  )

  router.get('/api/projects/:projectId/glossary', ({ params }) => getGlossary(params.projectId))
  router.put('/api/projects/:projectId/glossary', ({ params, body }) => {
    const { markdown, baseVersion } = parse(glossaryBody, body)
    return glossary.save(params.projectId, markdown, baseVersion)
  })
}
