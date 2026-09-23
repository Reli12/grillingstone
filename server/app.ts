// The HTTP API. Local-only (127.0.0.1, no auth); browser requests must come from the Vite origin and carry
// JSON, so another website open in the same browser cannot drive the tool.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ALLOWED_ORIGINS } from './config.ts'
import { readBody } from './http/body.ts'
import { HttpError, knownError } from './http/errors.ts'
import { Router } from './http/router.ts'
import type { AppDeps } from './routes/deps.ts'
import { draftRoutes } from './routes/draftRoutes.ts'
import { projectRoutes } from './routes/projectRoutes.ts'
import { sessionRoutes } from './routes/sessionRoutes.ts'
import { settingsRoutes } from './routes/settingsRoutes.ts'
import { templateRoutes } from './routes/templateRoutes.ts'

export function createApp(deps: AppDeps) {
  const router = new Router()
  settingsRoutes(router)
  projectRoutes(router, deps)
  draftRoutes(router, deps)
  sessionRoutes(router, deps)
  templateRoutes(router, deps)

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const send = (status: number, data: unknown) => {
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
      const body = method === 'GET' ? {} : await readBody(req)
      send(200, await route.handler({ params: route.params, body, req }))
    } catch (e) {
      const known = knownError(e)
      if (known) return send(known.status, known.body)
      console.error('[api]', e)
      send(500, { error: e instanceof Error ? e.message : 'Unexpected error' })
    }
  }
}
