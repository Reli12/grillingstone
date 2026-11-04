// A fake of the Prototype endpoints for component and page tests: a Draft's rows, the Images its start form
// offers, start and stop, and one Prototype's record. It records the requests it gets.
import { http, HttpResponse } from 'msw'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { DraftImage, Prototype, PrototypeRow, TickedImage } from '#core/prototype/prototypeRecords.ts'
import type { ValidImage } from '#core/session/images.ts'
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { server } from '@test/mocks/server'

const url = (path: string) => `*${path}`

export const sessionOf = (draft: Draft, patch: Partial<PrototypeSessionSummary> = {}): PrototypeSessionSummary => ({
  id: 'psess-1',
  kind: 'prototype',
  projectId: draft.projectId,
  draftId: draft.id,
  draftVersion: draft.version,
  status: 'thinking',
  startedAt: '2026-10-25T10:00:00Z',
  ...patch,
})

export const prototypeOf = (draft: Draft, patch: Partial<Prototype> = {}): Prototype => ({
  id: 'proto-1',
  projectId: draft.projectId,
  draftId: draft.id,
  draftVersion: draft.version,
  writtenAt: '2026-10-25T10:00:00Z',
  images: [],
  assumptions: [{ choice: 'Ten rows per page', why: 'The Draft gives no page size.' }],
  ...patch,
})

export const finishedRow = (draft: Draft, patch: Partial<Prototype> = {}): PrototypeRow => ({
  kind: 'finished',
  prototype: prototypeOf(draft, patch),
})

export const draftImageOf = (number: number, patch: Partial<DraftImage> = {}): DraftImage => ({
  sessionId: 'sess-first',
  number,
  mediaType: 'image/png',
  bytes: 1000,
  startedAt: '2026-10-01T09:00:00Z',
  ...patch,
})

/** What the inputs route answers for a session, for 'Try again'. */
export interface SessionInputs {
  tickedImages: TickedImage[]
  extraImages: ValidImage[]
  startingPrototypeId?: string
}

interface Options {
  rows?: PrototypeRow[]
  images?: DraftImage[]
  draftTitle?: string
  /** Session id → the inputs it was started with. */
  inputs?: Record<string, SessionInputs>
}

const rowIdOf = (row: PrototypeRow) => (row.kind === 'finished' ? row.prototype.id : row.session.id)

export function prototypeBackend(
  draft: Draft,
  { rows = [], images = [], draftTitle = draft.title, inputs = {} }: Options = {},
) {
  const state = { rows, images, requests: [] as { method: string; path: string; body: unknown }[] }
  const { projectId, id: draftId } = draft
  const record = async (request: Request) => {
    const body = request.method === 'GET' ? undefined : await request.json().catch(() => undefined)
    state.requests.push({ method: request.method, path: new URL(request.url).pathname, body })
    return body
  }

  server.use(
    http.get(url(endpoints.draftPrototypes(projectId, draftId)), () => HttpResponse.json(state.rows)),
    http.get(url(endpoints.draftPrototypeImages(projectId, draftId)), () => HttpResponse.json(state.images)),
    http.post(url(endpoints.startPrototype(projectId, draftId)), async ({ request }) => {
      await record(request)
      return HttpResponse.json(sessionOf(draft, { status: 'starting' }))
    }),
    http.post(url(`/api/projects/${projectId}/prototype-sessions/:sessionId/stop`), async ({ request }) => {
      await record(request)
      return HttpResponse.json({ ok: true })
    }),
    http.get(url(endpoints.projectPrototypes(projectId)), () => HttpResponse.json(state.rows)),
    http.get(url(`/api/projects/${projectId}/prototype-sessions/:sessionId/inputs`), ({ params }) => {
      const found = inputs[String(params.sessionId)]
      return found ? HttpResponse.json(found) : HttpResponse.json({ error: 'No such session' }, { status: 404 })
    }),
    // Delete and Dismiss take the row off the list, like the backend does.
    http.delete(url(`/api/projects/${projectId}/prototypes/:prototypeId`), async ({ request, params }) => {
      await record(request)
      state.rows = state.rows.filter((row) => rowIdOf(row) !== params.prototypeId)
      return HttpResponse.json({ ok: true })
    }),
    http.delete(url(`/api/projects/${projectId}/prototype-sessions/:sessionId`), async ({ request, params }) => {
      await record(request)
      state.rows = state.rows.filter((row) => rowIdOf(row) !== params.sessionId)
      return HttpResponse.json({ ok: true })
    }),
    http.get(url(`/api/projects/${projectId}/prototypes/:prototypeId`), ({ params }) => {
      const found = state.rows.find((row) => row.kind === 'finished' && row.prototype.id === params.prototypeId)
      if (found?.kind !== 'finished') return HttpResponse.json({ error: 'No such Prototype' }, { status: 404 })
      return HttpResponse.json({ prototype: found.prototype, draftTitle })
    }),
  )
  return state
}
