// Backlog Copy routes (ADR-0015): list a Project's Copies with the Drafts referencing them, paste, re-paste, delete.
// The service refuses all of them for a Project whose Tracker is not Azure DevOps.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { pastedCopyBody, repasteBody } from '../http/schemas.ts'
import type { AppDeps } from './deps.ts'

const COPIES = '/api/projects/:projectId/backlog-copies'

export function backlogCopyRoutes(router: Router, { backlogCopies }: AppDeps) {
  router.get(COPIES, ({ params }) => backlogCopies.list(params.projectId))
  router.post(COPIES, ({ params, body }) => backlogCopies.create(params.projectId, parse(pastedCopyBody, body)))
  router.put(`${COPIES}/:copyId`, ({ params, body }) =>
    backlogCopies.repaste(params.projectId, params.copyId, parse(repasteBody, body)),
  )
  router.delete(`${COPIES}/:copyId`, async ({ params }) => {
    await backlogCopies.delete(params.projectId, params.copyId)
    return { ok: true }
  })
}
