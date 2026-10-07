import type { Reason } from '#core/shared/validation.ts'

import { ApiError } from '@/api/apiError'

interface ErrorBody {
  error?: string
  reasons?: Reason[]
}

/** Core fetch for the local backend (proxied by Vite under /api). Local tool: no auth token. */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers },
  })
  // A failed request may not carry a JSON body; fall back to an empty error.
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) {
    const { error, reasons } = data as ErrorBody
    throw new ApiError(error ?? `Request failed (${res.status})`, res.status, reasons)
  }
  return data as T
}
