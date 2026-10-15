// The one place the frontend calls fetch: JSON in, JSON out, and an ApiError carrying the backend's
// message on any non-2xx response.
import type { Reason } from '#core/shared/validation.ts'

import { ApiError } from '@/api/apiError'

interface ErrorBody {
  error?: string
  reasons?: Reason[]
  code?: string
}

const JSON_CONTENT_TYPE = { 'content-type': 'application/json' }

/** Core fetch for the local backend (proxied by Vite under /api). Local tool: no auth token. */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const bodyHeaders = init.body !== undefined ? JSON_CONTENT_TYPE : {}
  const res = await fetch(url, { ...init, headers: { ...bodyHeaders, ...init.headers } })
  // A failed request may not carry a JSON body; fall back to an empty error.
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) {
    const { error, reasons, code } = data as ErrorBody
    throw new ApiError(error ?? `Request failed (${res.status})`, res.status, reasons, code)
  }
  return data as T
}
