// Azure DevOps routes: the Connection, a Project's Backlog and Default Tags, revision checks, Import, Publish, Link
// and Drift on a Draft, and Fetch and Refresh of Backlog Copies. The token never appears in any answer.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import {
  backlogBody,
  connectionBody,
  defaultTagsBody,
  importCopyBody,
  importWorkItemBody,
  publishBody,
  publishPlanBody,
  workItemBody,
} from '../http/schemas.ts'
import type { AppDeps } from './deps.ts'

const PROJECT = '/api/projects/:projectId'
const DRAFT = `${PROJECT}/drafts/:draftId`
const COPIES = `${PROJECT}/backlog-copies`

export function adoRoutes(router: Router, { connection, backlog, publish, imports }: AppDeps) {
  router.get('/api/connection', () => connection.status())
  router.put('/api/connection', ({ body }) => {
    const { orgUrl, token } = parse(connectionBody, body)
    return connection.testAndSave(orgUrl, token)
  })
  router.delete('/api/connection', () => connection.disconnect())

  router.put(`${PROJECT}/backlog`, ({ params, body }) =>
    backlog.setBacklog(params.projectId, parse(backlogBody, body).name),
  )
  router.delete(`${PROJECT}/backlog`, ({ params }) => backlog.clearBacklog(params.projectId))
  router.put(`${PROJECT}/default-tags`, ({ params, body }) =>
    backlog.setDefaultTags(params.projectId, parse(defaultTagsBody, body).tags),
  )
  router.get(`${PROJECT}/revisions`, ({ params }) => publish.revisions(params.projectId))

  router.post(`${PROJECT}/work-items/lookup`, ({ params, body }) =>
    imports.lookup(params.projectId, parse(workItemBody, body).workItem),
  )
  router.post(`${PROJECT}/drafts/import`, ({ params, body }) => {
    const { workItem, templateId } = parse(importWorkItemBody, body)
    return imports.importDraft(params.projectId, workItem, templateId)
  })

  router.post(`${DRAFT}/publish/plan`, ({ params, body }) =>
    publish.plan(params.projectId, params.draftId, parse(publishPlanBody, body)),
  )
  router.post(`${DRAFT}/publish`, ({ params, body }) =>
    publish.publish(params.projectId, params.draftId, parse(publishBody, body)),
  )
  router.delete(`${DRAFT}/link`, ({ params }) => publish.unlink(params.projectId, params.draftId))
  router.post(`${DRAFT}/drift-check`, ({ params }) => publish.driftCheck(params.projectId, params.draftId))

  router.post(`${COPIES}/fetch`, ({ params, body }) =>
    imports.fetchCopy(params.projectId, parse(workItemBody, body).workItem),
  )
  router.post(`${COPIES}/refresh-all`, ({ params }) => imports.refreshAll(params.projectId))
  router.post(`${COPIES}/:copyId/refresh`, ({ params }) => imports.refresh(params.projectId, params.copyId))
  router.post(`${COPIES}/:copyId/import`, ({ params, body }) =>
    imports.importCopy(params.projectId, params.copyId, parse(importCopyBody, body).templateId),
  )
}
