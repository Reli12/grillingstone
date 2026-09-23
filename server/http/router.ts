import type { IncomingMessage } from 'node:http'

export interface RequestContext {
  params: Record<string, string>
  /** Parsed JSON, not yet validated — handlers validate it with `parse`. */
  body: unknown
  req: IncomingMessage
}

export type Handler = (ctx: RequestContext) => unknown

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
}

/** A route table with `:param` path segments. */
export class Router {
  private routes: Route[] = []

  add(method: string, path: string, handler: Handler) {
    const keys: string[] = []
    const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`)
    this.routes.push({ method, pattern, keys, handler })
  }

  get = (path: string, handler: Handler) => this.add('GET', path, handler)
  post = (path: string, handler: Handler) => this.add('POST', path, handler)
  put = (path: string, handler: Handler) => this.add('PUT', path, handler)
  patch = (path: string, handler: Handler) => this.add('PATCH', path, handler)
  delete = (path: string, handler: Handler) => this.add('DELETE', path, handler)

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method) continue
      const m = r.pattern.exec(pathname)
      if (m) return { handler: r.handler, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
    }
    return null
  }
}
