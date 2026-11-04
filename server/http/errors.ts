// Every error the API can meet, mapped to an HTTP status in one place. Anything unknown is a 500.
import { DraftOpError } from '#core/draft/humanOps.ts'
import type { Reason } from '#core/shared/validation.ts'

import { DraftInputError } from '../services/draftService.ts'
import { SessionError } from '../sessions/sessionError.ts'
import { Conflict, NotFound, StaleWrite } from '../storage/errors.ts'
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
  [Conflict, 409],
  [DraftOpError, 409],
  [SessionError, 409],
  [TemplateError, 409],
]

/** A refusal with named reasons, answered as 422 so the browser can show each one. */
export class CodeFolderError extends Error {
  reasons: Reason[]
  constructor(reasons: Reason[]) {
    super(reasons.map((reason) => reason.message).join(' '))
    this.reasons = reasons
  }
}

/** The status and body to answer with, or null for an unexpected error. */
export function knownError(error: unknown): { status: number; body: { error: string; reasons?: Reason[] } } | null {
  if (error instanceof HttpError) return { status: error.status, body: { error: error.message } }
  if (error instanceof CodeFolderError) return { status: 422, body: { error: error.message, reasons: error.reasons } }
  const match = STATUS.find(([type]) => error instanceof type)
  return match ? { status: match[1], body: { error: (error as Error).message } } : null
}
