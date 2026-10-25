// Draft routes: list, create (which starts the first Grilling Session), read, delete, human edits and Proposal triage.
import { copyFields } from '#core/publish/copyFields.ts'
import { parseMessageImages } from '#core/session/images.ts'

import { IMAGE_MAX_BODY, parse } from '../http/body.ts'
import { HttpError } from '../http/errors.ts'
import type { Router } from '../http/router.ts'
import { decideBody, humanOpBody, newDraftBody, referencesBody } from '../http/schemas.ts'
import { getDraft, listDrafts, summarize } from '../storage/drafts.ts'
import type { AppDeps } from './deps.ts'

const DRAFT = '/api/projects/:projectId/drafts/:draftId'

export function draftRoutes(router: Router, { drafts, supervisor }: AppDeps) {
  router.get('/api/projects/:projectId/drafts', async ({ params }) =>
    (await listDrafts(params.projectId)).map(summarize),
  )
  router.post(
    '/api/projects/:projectId/drafts',
    async ({ params, body }) => {
      const { images, ...fields } = parse(newDraftBody, body)
      // Checked before the Draft exists, so refused Images leave no Draft behind; the session checks them again.
      const checked = parseMessageImages(images)
      if (!checked.ok) throw new HttpError(409, checked.reasons.map((reason) => reason.message).join(' '))
      const draft = await drafts.create(params.projectId, fields)
      const session = await supervisor.start({ projectId: params.projectId, draftId: draft.id, kind: 'first', images })
      return { draft, session }
    },
    { maxBody: IMAGE_MAX_BODY },
  )
  router.get(DRAFT, async ({ params }) => {
    const draft = await getDraft(params.projectId, params.draftId)
    return { draft, liveSession: supervisor.liveForDraft(draft.id) ?? null }
  })
  router.delete(DRAFT, async ({ params }) => {
    // A live session keeps writing its Transcript and Images, so the Draft stays until it is stopped.
    if (supervisor.hasSessionOn(params.draftId)) throw new HttpError(409, 'Stop the running session first.')
    await drafts.delete(params.projectId, params.draftId)
    return { ok: true }
  })
  router.patch(`${DRAFT}/references`, ({ params, body }) =>
    drafts.setReferences(params.projectId, params.draftId, parse(referencesBody, body).references),
  )
  router.post(`${DRAFT}/ops`, ({ params, body }) =>
    drafts.edit(params.projectId, params.draftId, parse(humanOpBody, body)),
  )
  router.post(`${DRAFT}/proposal/decide`, ({ params, body }) => {
    const { changeId, accept } = parse(decideBody, body)
    return drafts.decide(params.projectId, params.draftId, changeId, accept)
  })
  router.post(`${DRAFT}/proposal/accept-clean`, ({ params }) => drafts.acceptAllClean(params.projectId, params.draftId))
  router.get(`${DRAFT}/copy`, async ({ params }) => copyFields(await getDraft(params.projectId, params.draftId)))
}
