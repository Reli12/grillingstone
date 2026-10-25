// A minimal route table: each route is a method plus a path with `:param` segments, matched in the order
// the routes were added. app.ts owns the request handling around it.
import type { IncomingMessage } from 'node:http'

export interface RequestContext {
  params: Record<string, string>
  /** Parsed JSON, not yet validated — handlers validate it with `parse`. */
  body: unknown
  req: IncomingMessage
}

export type Handler = (ctx: RequestContext) => unknown

/** A binary answer (an Image), sent as it is instead of as JSON. */
export class RawReply {
  contentType: string
  bytes: Buffer
  constructor(contentType: string, bytes: Buffer) {
    this.contentType = contentType
    this.bytes = bytes
  }
}

export interface RouteOptions {
  /** A larger request body than the default, for routes that take Images. */
  maxBody?: number
}

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
  options: RouteOptions
}

/** A `:name` path segment; captures the name. */
const PARAM_SEGMENT = /:(\w+)/g
/** What a `:name` segment matches in a request path: one segment, captured. */
const PARAM_VALUE = '([^/]+)'

/** A route table with `:param` path segments. */
export class Router {
  private routes: Route[] = []

  add(method: string, path: string, handler: Handler, options: RouteOptions = {}) {
    const keys: string[] = []
    const source = path.replace(PARAM_SEGMENT, (_match: string, key: string) => {
      keys.push(key)
      return PARAM_VALUE
    })
    const pattern = new RegExp(`^${source}$`)
    this.routes.push({ method, pattern, keys, handler, options })
  }

  get = (path: string, handler: Handler) => this.add('GET', path, handler)
  post = (path: string, handler: Handler, options?: RouteOptions) => this.add('POST', path, handler, options)
  put = (path: string, handler: Handler) => this.add('PUT', path, handler)
  patch = (path: string, handler: Handler) => this.add('PATCH', path, handler)
  delete = (path: string, handler: Handler) => this.add('DELETE', path, handler)

  match(
    method: string,
    pathname: string,
  ): { handler: Handler; params: Record<string, string>; options: RouteOptions } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue
      const found = route.pattern.exec(pathname)
      if (!found) continue
      // Capture group i + 1 holds the value of the i-th `:param`.
      const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]))
      return { handler: route.handler, params, options: route.options }
    }
    return null
  }
}
