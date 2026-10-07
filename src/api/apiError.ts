// The error every failed backend call throws: the backend's human-readable message, the HTTP
// status, and the per-field reasons a validation failure carries.
import type { Reason } from '#core/shared/validation.ts'

export class ApiError extends Error {
  status: number
  reasons?: Reason[]
  constructor(message: string, status: number, reasons?: Reason[]) {
    super(message)
    this.status = status
    this.reasons = reasons
  }
}
