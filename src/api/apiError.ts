// The error every failed backend call throws: the backend's human-readable message, the HTTP
// status, and the per-field reasons a validation failure carries.
import type { Reason } from '#core/shared/validation.ts'

export class ApiError extends Error {
  status: number
  reasons?: Reason[]
  /** A Draft the refusal points to, e.g. the one already linked to a work item. */
  draftId?: string
  constructor(message: string, status: number, reasons?: Reason[], draftId?: string) {
    super(message)
    this.status = status
    this.reasons = reasons
    if (draftId) this.draftId = draftId
  }
}
