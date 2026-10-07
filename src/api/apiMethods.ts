// The HTTP verbs as one-liners over fetchJson, so the domain API files only name a URL and a body.
import { fetchJson } from '@/api/fetchJson'

export const api = {
  get: <T>(url: string) => fetchJson<T>(url),
  post: <T>(url: string, body: unknown = {}) => fetchJson<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => fetchJson<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => fetchJson<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => fetchJson<T>(url, { method: 'DELETE', body: '{}' }),
}
