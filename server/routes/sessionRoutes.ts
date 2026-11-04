// Session routes: start and continue Grilling Sessions, talk to any running session, take a session's
// submission, and run Template Sessions.
import { IMAGE_MAX_BODY, parse } from '../http/body.ts'
import { RawReply, type Router } from '../http/router.ts'
import { continueSessionBody, sayBody, startSessionBody, templateSessionBody } from '../http/schemas.ts'
import type { Supervisor } from '../sessions/supervisor.ts'
import { NotFound } from '../storage/errors.ts'
import { readImage } from '../storage/images.ts'
import { getTemplateTranscript, getTranscript, listTranscripts } from '../storage/transcripts.ts'
import type { AppDeps } from './deps.ts'

/** The header scripts/writeDraft.mjs sends the session's token in. */
const SESSION_TOKEN_HEADER = 'x-pbi-session-token'

/** The routes that take Images (saying something, starting a session) accept a larger body than the rest. */
const WITH_IMAGES = { maxBody: IMAGE_MAX_BODY }

/**
 * The Image a Transcript of this Project lists under this number; an Image of another Project is not found. A
 * running session's Transcript is read from memory, so its thumbnails do not each parse the file again.
 */
async function findImageRef(supervisor: Supervisor, ids: { projectId: string; sessionId: string }, number: number) {
  const { projectId, sessionId } = ids
  const live = supervisor.liveTranscript(sessionId)
  if (live && live.projectId !== projectId) throw new NotFound(`No session ${sessionId} in this Project`)
  const transcript = live ?? (await getTranscript(projectId, sessionId))
  for (const message of transcript.messages) {
    if (message.role !== 'human') continue
    const ref = message.images?.find((image) => image.number === number)
    if (ref) return ref
  }
  throw new NotFound(`No Image ${number} in session ${sessionId}`)
}

export function sessionRoutes(router: Router, { supervisor }: AppDeps) {
  // Grilling Sessions
  router.get('/api/projects/:projectId/drafts/:draftId/sessions', ({ params }) =>
    listTranscripts(params.projectId, params.draftId),
  )
  router.post(
    '/api/projects/:projectId/drafts/:draftId/sessions',
    ({ params, body }) =>
      supervisor.start({ projectId: params.projectId, draftId: params.draftId, ...parse(startSessionBody, body) }),
    WITH_IMAGES,
  )
  router.get('/api/projects/:projectId/sessions/:sessionId/images/:number', async ({ params }) => {
    const { projectId, sessionId } = params
    const ref = await findImageRef(supervisor, { projectId, sessionId }, Number(params.number))
    const bytes = await readImage({ projectId, sessionId, number: ref.number, mediaType: ref.mediaType })
    return new RawReply(ref.mediaType, bytes)
  })
  router.post('/api/projects/:projectId/drafts/:draftId/sessions/:sessionId/continue', ({ params, body }) => {
    const { humanNote, prototypeIds } = parse(continueSessionBody, body)
    return supervisor.continue(params.projectId, params.draftId, params.sessionId, { humanNote, prototypeIds })
  })

  // Either kind of session
  router.post(
    '/api/sessions/:sessionId/messages',
    async ({ params, body }) => {
      const { text, kind, images } = parse(sayBody, body)
      await supervisor.say(params.sessionId, { text, kind, images })
      return { ok: true }
    },
    WITH_IMAGES,
  )
  router.post('/api/sessions/:sessionId/write', async ({ params }) => {
    await supervisor.writeNow(params.sessionId)
    return { ok: true }
  })
  router.post('/api/sessions/:sessionId/stop', ({ params }) => {
    supervisor.stop(params.sessionId)
    return { ok: true }
  })
  // Called by scripts/writeDraft.mjs from inside a session, authenticated by the session's token.
  router.post('/api/internal/sessions/:sessionId/submit', ({ params, body, req }) =>
    supervisor.submit(params.sessionId, String(req.headers[SESSION_TOKEN_HEADER] ?? ''), body),
  )

  // Template Sessions
  router.get('/api/template-sessions/live', () => ({ session: supervisor.liveTemplateSession() ?? null }))
  router.get('/api/template-sessions/:sessionId', ({ params }) => getTemplateTranscript(params.sessionId))
  router.post('/api/template-sessions', ({ body }) => {
    const { baseTemplateId, ...request } = parse(templateSessionBody, body)
    return supervisor.startTemplate({ ...request, ...(baseTemplateId ? { baseTemplateId } : {}) })
  })
}
