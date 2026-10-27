// The HTTP API. Local-only (127.0.0.1, no auth); browser requests must come from the Vite origin and carry
// JSON, so another website open in the same browser cannot drive the tool.
import type { IncomingMessage, ServerResponse } from 'node:http'

import { ALLOWED_ORIGINS } from './config.ts'
import { readBody } from './http/body.ts'
import { HttpError, knownError } from './http/errors.ts'
import { RawReply, Router } from './http/router.ts'
import type { AppDeps } from './routes/deps.ts'
import { draftRoutes } from './routes/draftRoutes.ts'
import { projectRoutes } from './routes/projectRoutes.ts'
import { prototypeRoutes } from './routes/prototypeRoutes.ts'
import { sessionRoutes } from './routes/sessionRoutes.ts'
import { settingsRoutes } from './routes/settingsRoutes.ts'
import { templateRoutes } from './routes/templateRoutes.ts'

export function buildRouter(deps: AppDeps) {
  const router = new Router()
  settingsRoutes(router)
  projectRoutes(router, deps)
  draftRoutes(router, deps)
  sessionRoutes(router, deps)
  prototypeRoutes(router, deps)
  templateRoutes(router, deps)
  return router
}

/** An Image is immutable once saved and its URL is never reused, so the browser may keep it. */
const IMAGE_CACHE_CONTROL = 'private, max-age=86400, immutable'

export function createApp(deps: AppDeps) {
  const router = buildRouter(deps)

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const send = (status: number, data: unknown) => {
      if (data instanceof RawReply) {
        res.writeHead(status, {
          'content-type': data.contentType,
          'cache-control': IMAGE_CACHE_CONTROL,
          'x-content-type-options': 'nosniff',
          ...data.headers,
        })
        res.end(data.bytes)
        return
      }
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(data))
    }
    try {
      const origin = req.headers.origin
      if (origin && !ALLOWED_ORIGINS.has(origin)) throw new HttpError(403, 'Requests from other origins are refused.')
      const url = new URL(req.url ?? '/', 'http://localhost')
      const method = req.method ?? 'GET'
      if (method !== 'GET' && !String(req.headers['content-type'] ?? '').startsWith('application/json'))
        throw new HttpError(415, 'Send JSON (content-type: application/json).')

      const route = router.match(method, url.pathname)
      if (!route) throw new HttpError(404, `No route ${method} ${url.pathname}`)
      const body = method === 'GET' ? {} : await readBody(req, route.options.maxBody)
      send(200, await route.handler({ params: route.params, body, req }))
    } catch (error) {
      const known = knownError(error)
      if (known) return send(known.status, known.body)
      console.error('[api]', error)
      send(500, { error: error instanceof Error ? error.message : 'Unexpected error' })
    }
  }

  // handle() answers every error itself, so the returned promise never rejects.
  return (req: IncomingMessage, res: ServerResponse) => void handle(req, res)
}
