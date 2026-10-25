// Reading request bodies: a size-capped JSON read, and validation against a zod schema with a 400 that
// names the first wrong field.
import type { IncomingMessage } from 'node:http'

import type { z } from 'zod'

import { HttpError } from './errors.ts'

/** Largest request body accepted by most routes, in bytes; anything bigger is refused before it is parsed. */
export const DEFAULT_MAX_BODY = 5_000_000
/** The routes that take Images (five of up to 5 MB, as base64) accept a larger body. */
export const IMAGE_MAX_BODY = 40_000_000

export async function readBody(req: IncomingMessage, maxBody = DEFAULT_MAX_BODY): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > maxBody) throw new HttpError(413, 'Request too large.')
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
