import type { IncomingMessage } from 'node:http'

import type { z } from 'zod'

import { HttpError } from './errors.ts'

const MAX_BODY = 5_000_000

export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large.')
    chunks.push(chunk as Buffer)
  }
  if (!size) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid JSON.')
  }
}

/** The body as `schema` describes it, or a 400 naming the first thing wrong with it. */
export function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const where = issue.path.length ? `"${issue.path.join('.')}": ` : ''
  throw new HttpError(400, `${where}${issue.message}`)
}
