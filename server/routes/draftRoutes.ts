import { render } from '#core/publish/publishRenderer.ts'
import { parse } from '../http/body.ts'
import { HttpError } from '../http/errors.ts'
import type { Router } from '../http/router.ts'
import { decideBody, humanOpBody, newDraftBody, referencesBody } from '../http/schemas.ts'
import { getDraft, listDrafts, summarize } from '../storage/drafts.ts'
import type { AppDeps } from './deps.ts'

const DRAFT = '/api/projects/:projectId/drafts/:draftId'

export function draftRoutes(r: Router, { drafts, supervisor }: AppDeps) {
  r.get('/api/projects/:projectId/drafts', async ({ params }) => (await listDrafts(params.projectId)).map(summarize))
  r.post('/api/projects/:projectId/drafts', async ({ params, body }) => {
    const draft = await drafts.create(params.projectId, parse(newDraftBody, body))
    const session = await supervisor.start({ projectId: params.projectId, draftId: draft.id, kind: 'first' })
    return { draft, session }
  })
  r.get(DRAFT, async ({ params }) => {
    const draft = await getDraft(params.projectId, params.draftId)
    return { draft, liveSession: supervisor.liveForDraft(draft.id) ?? null }
  })
  r.delete(DRAFT, async ({ params }) => {
    if (supervisor.liveForDraft(params.draftId)) throw new HttpError(409, 'Stop the running session first.')
    await drafts.delete(params.projectId, params.draftId)
    return { ok: true }
  })
  r.patch(`${DRAFT}/references`, ({ params, body }) => drafts.setReferences(params.projectId, params.draftId, parse(referencesBody, body).references))
  r.post(`${DRAFT}/ops`, ({ params, body }) => drafts.edit(params.projectId, params.draftId, parse(humanOpBody, body)))
  r.post(`${DRAFT}/proposal/decide`, ({ params, body }) => {
    const { changeId, accept } = parse(decideBody, body)
    return drafts.decide(params.projectId, params.draftId, changeId, accept)
  })
  r.post(`${DRAFT}/proposal/accept-clean`, ({ params }) => drafts.acceptAllClean(params.projectId, params.draftId))
  r.get(`${DRAFT}/render`, async ({ params }) => render(await getDraft(params.projectId, params.draftId)))
}
