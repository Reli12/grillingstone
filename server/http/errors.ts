// Every error the API can meet, mapped to an HTTP status in one place. Anything unknown is a 500.
import { DraftOpError } from '#core/draft/humanOps.ts'

import { DraftInputError } from '../services/draftService.ts'
import { SessionError } from '../sessions/sessionError.ts'
import { NotFound, StaleWrite, UnsafeFile } from '../storage/errors.ts'
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
  [UnsafeFile, 409],
  [DraftOpError, 409],
  [SessionError, 409],
  [TemplateError, 409],
]

type ErrorBody = { error: string; code?: string }

/** The status and body to answer with, or null for an unexpected error. */
export function knownError(error: unknown): { status: number; body: ErrorBody } | null {
  if (error instanceof HttpError) return { status: error.status, body: { error: error.message } }
  const match = STATUS.find(([type]) => error instanceof type)
  if (!match) return null
  const { message, code } = error as Error & { code?: unknown }
  // Only the sessions layer's own codes (strings) reach the browser, not a system error's errno name.
  const body: ErrorBody =
    error instanceof SessionError && typeof code === 'string' ? { error: message, code } : { error: message }
  return { status: match[1], body }
}
