// The toast every failed action shows (ADR-0011): the backend's message, and, when the Assistant in Settings
// cannot run, a way straight to Settings to switch or see how to fix it.
import { toast } from 'sonner'

import { ASSISTANT_UNAVAILABLE } from '#core/contract/apiTypes.ts'

import { ApiError } from '@/api/apiError'

export function toastMutationError(error: Error, openSettings: () => void) {
  if (error instanceof ApiError && error.code === ASSISTANT_UNAVAILABLE) {
    toast.error(error.message, { action: { label: 'Open Settings', onClick: openSettings } })
    return
  }
  toast.error(error.message)
}
