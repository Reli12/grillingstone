// The error every failed backend call throws: the backend's human-readable message, the HTTP
// status, the per-field reasons a validation failure carries, and a code for errors handled specially.
import type { Reason } from '#core/shared/validation.ts'

export class ApiError extends Error {
  status: number
  reasons?: Reason[]
  code?: string
  constructor(message: string, status: number, reasons?: Reason[], code?: string) {
    super(message)
    this.status = status
    this.reasons = reasons
    this.code = code
  }
}
