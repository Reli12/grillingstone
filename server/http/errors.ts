// Every error the API can meet, mapped to an HTTP status in one place. Anything unknown is a 500.
import { DraftOpError } from '#core/draft/humanOps.ts'
import { DraftInputError } from '../services/draftService.ts'
import { SessionError } from '../sessions/sessionError.ts'
import { NotFound, StaleWrite } from '../storage/errors.ts'
import { TemplateError } from '../storage/templates.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const STATUS: [new (...args: never[]) => Error, number][] = [
  [DraftInputError, 400],
  [NotFound, 404],
  [StaleWrite, 409],
  [DraftOpError, 409],
  [SessionError, 409],
  [TemplateError, 409],
]

/** The status and body to answer with, or null for an unexpected error. */
export function knownError(e: unknown): { status: number; body: { error: string } } | null {
  if (e instanceof HttpError) return { status: e.status, body: { error: e.message } }
  const match = STATUS.find(([type]) => e instanceof type)
  return match ? { status: match[1], body: { error: (e as Error).message } } : null
}
