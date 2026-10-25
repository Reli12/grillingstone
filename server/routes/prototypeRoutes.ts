// Prototype routes (ADR-0023): start and stop a Prototype Session, the lists of rows by Draft and by Project, the
// inputs of a session (for 'Try again'), a Prototype's record, and the view route that serves its page sandboxed.
import { PROTOTYPE_VIEW_CSP } from '#core/prototype/prototypeAssembly.ts'
import { prototypeFileName } from '#core/prototype/prototypeFileName.ts'
import { prototypeRows } from '#core/prototype/prototypeRecords.ts'

import { IMAGE_MAX_BODY, parse } from '../http/body.ts'
import { RawReply, type Router } from '../http/router.ts'
import { startPrototypeBody } from '../http/schemas.ts'
import { getDraft } from '../storage/drafts.ts'
import {
  getPrototype,
  getPrototypeSession,
  listPrototypes,
  listPrototypeSessions,
  readExtraImages,
  readPrototypeHtml,
} from '../storage/prototypes.ts'
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

export function prototypeRoutes(router: Router, { supervisor }: AppDeps) {
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
  router.get(`${PROJECT}/drafts/:draftId/prototypes`, async ({ params }) =>
    prototypeRows(
      await listPrototypes(params.projectId, params.draftId),
      await listPrototypeSessions(params.projectId, params.draftId),
    ),
  )
  router.get(`${PROJECT}/prototypes`, async ({ params }) =>
    prototypeRows(await listPrototypes(params.projectId), await listPrototypeSessions(params.projectId)),
  )
  router.get(`${PROJECT}/prototype-sessions/:sessionId/inputs`, async ({ params }) => {
    const { inputs } = await getPrototypeSession(params.projectId, params.sessionId)
    const { extraImages, ...rest } = inputs
    return { ...rest, extraImages: await readExtraImages(params.projectId, params.sessionId, extraImages) }
  })
  router.get(`${PROJECT}/prototypes/:prototypeId`, async ({ params }) => {
    const prototype = await getPrototype(params.projectId, params.prototypeId)
    const draft = await getDraft(params.projectId, prototype.draftId)
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
      const draft = await getDraft(params.projectId, prototype.draftId)
      const { draftVersion, writtenAt } = prototype
      const name = prototypeFileName({ draftTitle: draft.title, draftVersion, writtenAt })
      headers['content-disposition'] = attachment(name)
    }
    return new RawReply('text/html; charset=utf-8', Buffer.from(html, 'utf8'), headers)
  })
}
