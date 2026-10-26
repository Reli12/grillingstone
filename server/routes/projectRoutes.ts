// Project routes: list, create (optionally seeding the Glossary), rename or change the Tracker, delete, and read
// or save the Glossary.
import { startingGlossary } from '#core/glossary/glossary.ts'

import { parse } from '../http/body.ts'
import { HttpError } from '../http/errors.ts'
import type { Router } from '../http/router.ts'
import { glossaryBody, newProjectBody, projectUpdateBody } from '../http/schemas.ts'
import { now } from '../services/clock.ts'
import { listDrafts } from '../storage/drafts.ts'
import { getGlossary, startGlossary } from '../storage/glossary.ts'
import { createProject, deleteProject, getProject, listProjects, updateProject } from '../storage/projects.ts'
import { getSettings } from '../storage/settings.ts'
import type { AppDeps } from './deps.ts'

export function projectRoutes(router: Router, { glossary, supervisor }: AppDeps) {
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
  router.delete('/api/projects/:projectId', async ({ params }) => {
    // A live session keeps writing into the Project's folder, so the Project stays until every session is stopped.
    const drafts = await listDrafts(params.projectId)
    if (drafts.some((draft) => supervisor.hasSessionOn(draft.id)))
      throw new HttpError(409, 'Stop the running session in this Project first.')
    await deleteProject(params.projectId)
    return { ok: true }
  })

  router.get('/api/projects/:projectId/glossary', ({ params }) => getGlossary(params.projectId))
  router.put('/api/projects/:projectId/glossary', ({ params, body }) => {
    const { markdown, baseVersion } = parse(glossaryBody, body)
    return glossary.save(params.projectId, markdown, baseVersion)
  })
}
