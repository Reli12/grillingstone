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
