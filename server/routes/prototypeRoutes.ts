// Prototype routes (ADR-0023): start and stop a Prototype Session, the lists of rows by Draft and by Project, the
// inputs of a session (for 'Try again'), a Prototype's record, and the view route that serves its page sandboxed.
import { PROTOTYPE_VIEW_CSP } from '#core/prototype/prototypeAssembly.ts'
import { prototypeFileName } from '#core/prototype/prototypeFileName.ts'
import { type DraftImage, prototypeRows } from '#core/prototype/prototypeRecords.ts'

import { IMAGE_MAX_BODY, parse } from '../http/body.ts'
import { RawReply, type Router } from '../http/router.ts'
import { sayBody, startPrototypeBody, startPrototypeGrillingBody } from '../http/schemas.ts'
import { humanImageRefs } from '../sessions/sessionImages.ts'
import { getDraft } from '../storage/drafts.ts'
import { NotFound } from '../storage/errors.ts'
import { imageBytes } from '../storage/images.ts'
import {
  getPrototype,
  getPrototypeGrillingSession,
  getPrototypeSession,
  listPrototypeGrillingSessions,
  listPrototypes,
  listPrototypeSessions,
  readExtraImages,
  readGrillingImage,
  readPrototypeHtml,
} from '../storage/prototypes.ts'
import { listTranscripts } from '../storage/transcripts.ts'
import type { AppDeps } from './deps.ts'

const PROJECT = '/api/projects/:projectId'

/** `?download=1` asks for the page as a file instead of a page. */
const wantsDownload = (url: string | undefined) =>
  new URL(url ?? '/', 'http://localhost').searchParams.get('download') === '1'

// Characters outside printable ASCII, and the quote and backslash that would end the quoted file name early.
const NOT_PLAIN_ASCII = /[^\x20-\x7e]|["\\]/g
// Characters encodeURIComponent leaves alone but RFC 5987 does not allow in an encoded file name.
const RFC5987_RESERVED = /['()*]/g

/** Content-Disposition for a download: a plain ASCII fallback, and the real name (en dashes, accents…) encoded. */
function attachment(fileName: string): string {
  const plain = fileName.replace(NOT_PLAIN_ASCII, '_')
  const encoded = encodeURIComponent(fileName).replace(
    RFC5987_RESERVED,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${plain}"; filename*=UTF-8''${encoded}`
}

/** The Images of the Draft's Grilling Sessions, oldest session first, each with its size on disk. */
async function draftImages(projectId: string, draftId: string): Promise<DraftImage[]> {
  const found = (await listTranscripts(projectId, draftId)).flatMap((transcript) =>
    humanImageRefs(transcript).map(async ({ number, mediaType }): Promise<DraftImage[]> => {
      const sessionId = transcript.id
      const bytes = await imageBytes({ projectId, sessionId, number, mediaType })
      return bytes === undefined ? [] : [{ sessionId, number, mediaType, bytes, startedAt: transcript.startedAt }]
    }),
  )
  return (await Promise.all(found)).flat()
}

export function prototypeRoutes(router: Router, { supervisor, prototypes }: AppDeps) {
  router.post(
    `${PROJECT}/drafts/:draftId/prototype-sessions`,
    ({ params, body }) => {
      const { projectId, draftId } = params
      return supervisor.startPrototype({ projectId, draftId, ...parse(startPrototypeBody, body) })
    },
    { maxBody: IMAGE_MAX_BODY },
  )
  router.post(`${PROJECT}/prototype-sessions/:sessionId/stop`, ({ params }) => {
    supervisor.stopPrototype(params.projectId, params.sessionId)
    return { ok: true }
  })

  // Prototype Grilling Sessions (ADR-0024). The Ready Check's "write it now" is the existing /api/sessions/:id/write.
  router.post(
    `${PROJECT}/prototype-grilling-sessions`,
    ({ params, body }) =>
      supervisor.startPrototypeGrilling({ projectId: params.projectId, ...parse(startPrototypeGrillingBody, body) }),
    { maxBody: IMAGE_MAX_BODY },
  )
  router.get(`${PROJECT}/prototype-grilling-sessions/:sessionId`, ({ params }) =>
    getPrototypeGrillingSession(params.projectId, params.sessionId),
  )
  // An Image of the session's own folder (added on the start form or in the conversation), for the session page.
  router.get(`${PROJECT}/prototype-grilling-sessions/:sessionId/images/:number`, async ({ params }) => {
    const { projectId, sessionId } = params
    const number = Number(params.number)
    const session = await getPrototypeGrillingSession(projectId, sessionId)
    const sent = session.messages.flatMap((message) => (message.role === 'human' ? (message.images ?? []) : []))
    const ref = [...sent, ...session.inputs.extraImages].find((image) => image.number === number)
    if (!ref) throw new NotFound(`No Image ${number} in session ${sessionId}`)
    return new RawReply(ref.mediaType, await readGrillingImage(projectId, sessionId, ref))
  })
  router.post(
    `${PROJECT}/prototype-grilling-sessions/:sessionId/messages`,
    async ({ params, body }) => {
      const { text, kind, images } = parse(sayBody, body)
      await supervisor.sayInPrototypeGrilling(params.projectId, params.sessionId, { text, kind, images })
      return { ok: true }
    },
    { maxBody: IMAGE_MAX_BODY },
  )
  router.post(`${PROJECT}/prototype-grilling-sessions/:sessionId/stop`, ({ params }) => {
    supervisor.stopPrototype(params.projectId, params.sessionId)
    return { ok: true }
  })
  // A Continuation (ADR-0014): a new session that resumes the ended one. Returns the new session.
  router.post(`${PROJECT}/prototype-grilling-sessions/:sessionId/continue`, ({ params }) =>
    supervisor.continuePrototypeGrilling(params.projectId, params.sessionId),
  )
  // Deletes an ended Draft-less session with its Prototypes and Transcript.
  router.delete(`${PROJECT}/prototype-grilling-sessions/:sessionId`, async ({ params }) => {
    await prototypes.deleteGrillingSession(params.projectId, params.sessionId)
    return { ok: true }
  })
  router.post(`${PROJECT}/prototype-grilling-sessions/:sessionId/end`, ({ params }) => {
    supervisor.endPrototypeGrilling(params.projectId, params.sessionId)
    return { ok: true }
  })

  router.get(`${PROJECT}/drafts/:draftId/prototypes`, async ({ params }) => {
    const { projectId, draftId } = params
    const [written, sessions, grilling] = await Promise.all([
      listPrototypes(projectId, draftId),
      listPrototypeSessions(projectId, draftId),
      listPrototypeGrillingSessions(projectId, draftId),
    ])
    return prototypeRows(written, sessions, grilling)
  })
  router.get(`${PROJECT}/prototypes`, async ({ params }) => {
    const [written, sessions, grilling] = await Promise.all([
      listPrototypes(params.projectId),
      listPrototypeSessions(params.projectId),
      listPrototypeGrillingSessions(params.projectId),
    ])
    return prototypeRows(written, sessions, grilling)
  })
  router.get(`${PROJECT}/drafts/:draftId/prototype-images`, async ({ params }) => {
    const { projectId, draftId } = params
    await getDraft(projectId, draftId)
    return draftImages(projectId, draftId)
  })
  router.get(`${PROJECT}/prototype-sessions/:sessionId/inputs`, async ({ params }) => {
    const { inputs } = await getPrototypeSession(params.projectId, params.sessionId)
    const { extraImages, ...rest } = inputs
    return { ...rest, extraImages: await readExtraImages(params.projectId, params.sessionId, extraImages) }
  })
  // Dismiss: a Failed or Stopped session's record and extra Images go; a running one is refused.
  router.delete(`${PROJECT}/prototype-sessions/:sessionId`, async ({ params }) => {
    await prototypes.dismiss(params.projectId, params.sessionId)
    return { ok: true }
  })
  router.delete(`${PROJECT}/prototypes/:prototypeId`, async ({ params }) => {
    await prototypes.delete(params.projectId, params.prototypeId)
    return { ok: true }
  })
  router.get(`${PROJECT}/prototypes/:prototypeId`, async ({ params }) => {
    const prototype = await getPrototype(params.projectId, params.prototypeId)
    // A Prototype of no Draft has no title to show.
    if (!prototype.draft) return { prototype }
    const draft = await getDraft(params.projectId, prototype.draft.draftId)
    return { prototype, draftTitle: draft.title }
  })
  router.get(`${PROJECT}/prototypes/:prototypeId/view`, async ({ params, req }) => {
    const prototype = await getPrototype(params.projectId, params.prototypeId)
    const html = await readPrototypeHtml(params.projectId, params.prototypeId)
    const headers: Record<string, string> = {
      'content-security-policy': PROTOTYPE_VIEW_CSP,
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    }
    if (wantsDownload(req.url)) {
      const { draft: link, writtenAt } = prototype
      const named = link
        ? { draftTitle: (await getDraft(params.projectId, link.draftId)).title, draftVersion: link.draftVersion }
        : {}
      headers['content-disposition'] = attachment(prototypeFileName({ ...named, writtenAt }))
    }
    return new RawReply('text/html; charset=utf-8', Buffer.from(html, 'utf8'), headers)
  })
}
