import { ApiError } from '@/api/apiError'

/** Core fetch for the local backend (proxied by Vite under /api). Local tool: no auth token. */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.reasons)
  return data as T
}
