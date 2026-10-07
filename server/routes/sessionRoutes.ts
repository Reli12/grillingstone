// Session routes: start and continue Grilling Sessions, talk to any running session, take a session's
// submission, and run Template Sessions.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { continueSessionBody, sayBody, startSessionBody, templateSessionBody } from '../http/schemas.ts'
import { getTemplateTranscript, listTranscripts } from '../storage/transcripts.ts'
import type { AppDeps } from './deps.ts'

/** The header scripts/writeDraft.mjs sends the session's token in. */
const SESSION_TOKEN_HEADER = 'x-pbi-session-token'

export function sessionRoutes(router: Router, { supervisor }: AppDeps) {
  // Grilling Sessions
  router.get('/api/projects/:projectId/drafts/:draftId/sessions', ({ params }) =>
    listTranscripts(params.projectId, params.draftId),
  )
  router.post('/api/projects/:projectId/drafts/:draftId/sessions', ({ params, body }) =>
    supervisor.start({ projectId: params.projectId, draftId: params.draftId, ...parse(startSessionBody, body) }),
  )
  router.post('/api/projects/:projectId/drafts/:draftId/sessions/:sessionId/continue', ({ params, body }) =>
    supervisor.continue(params.projectId, params.draftId, params.sessionId, parse(continueSessionBody, body).humanNote),
  )

  // Either kind of session
  router.post('/api/sessions/:sessionId/messages', async ({ params, body }) => {
    const { text, kind } = parse(sayBody, body)
    await supervisor.say(params.sessionId, text, kind)
    return { ok: true }
  })
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
