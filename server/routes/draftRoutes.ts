// Draft routes: list, create (which starts the first Grilling Session), read, delete, human edits and Proposal triage.
import { copyFields } from '#core/publish/copyFields.ts'
import { type ImageUpload, parseMessageImages } from '#core/session/images.ts'

import { IMAGE_MAX_BODY, parse } from '../http/body.ts'
import { HttpError } from '../http/errors.ts'
import type { Router } from '../http/router.ts'
import { decideBody, humanOpBody, newDraftBody, referencesBody } from '../http/schemas.ts'
import type { NewDraftInput } from '../services/draftService.ts'
import { getDraft, listDrafts, summarize } from '../storage/drafts.ts'
import { NotFound } from '../storage/errors.ts'
import { getPrototype } from '../storage/prototypes.ts'
import type { AppDeps } from './deps.ts'

const NOT_A_PROTOTYPE = 'A Prototype you gave is not one of this Project’s Prototypes.'

const DRAFT = '/api/projects/:projectId/drafts/:draftId'

export function draftRoutes(router: Router, { drafts, supervisor }: AppDeps) {
  async function createAndStart(
    projectId: string,
    { fields, images, prototypeIds }: { fields: NewDraftInput; images: ImageUpload[]; prototypeIds: string[] },
  ) {
    // Checked before the Draft exists, so refused Images leave no Draft behind; the session checks them again.
    const checked = parseMessageImages(images)
    if (!checked.ok) throw new HttpError(409, checked.reasons.map((reason) => reason.message).join(' '))
    // The same for the Prototypes given as context: a refused one leaves no Draft behind.
    for (const prototypeId of prototypeIds) {
      await getPrototype(projectId, prototypeId).catch((error: unknown) => {
        if (error instanceof NotFound) throw new HttpError(409, NOT_A_PROTOTYPE)
        throw error
      })
    }
    const draft = await drafts.create(projectId, fields)
    const session = await supervisor.start({ projectId, draftId: draft.id, kind: 'first', images, prototypeIds })
    return { draft, session }
  }

  router.get('/api/projects/:projectId/drafts', async ({ params }) =>
    (await listDrafts(params.projectId)).map(summarize),
  )
  router.post(
    '/api/projects/:projectId/drafts',
    ({ params, body }) => {
      const { images, prototypeIds, ...fields } = parse(newDraftBody, body)
      return createAndStart(params.projectId, { fields, images, prototypeIds })
    },
    { maxBody: IMAGE_MAX_BODY },
  )
  // Create Draft… on a Prototype: the Draft remembers it, and its first session is given it as context.
  router.post(
    '/api/projects/:projectId/prototypes/:prototypeId/drafts',
    async ({ params, body }) => {
      const { projectId, prototypeId } = params
      await getPrototype(projectId, prototypeId)
      const { images, prototypeIds: _ignored, ...fields } = parse(newDraftBody, body)
      return createAndStart(projectId, {
        fields: { ...fields, createdFromPrototypeId: prototypeId },
        images,
        prototypeIds: [prototypeId],
      })
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
