// A stateful fake of the Draft endpoints for page tests. It runs the real core modules (human edits,
// Proposal triage, the Publish Renderer), so the UI is tested against the behaviour the server has.
import { http, HttpResponse } from 'msw'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import { applyHumanEdit } from '#core/proposal/humanEdit.ts'
import { acceptAllClean, decide } from '#core/proposal/triage.ts'
import { copyFields } from '#core/publish/copyFields.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { meta } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { server } from '@test/mocks/server'

const url = (path: string) => `*${path}`

export const liveSession = (draft: Draft, patch: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 'sess-live',
  kind: 'iteration',
  status: 'waiting',
  writeConfirmed: false,
  startedAt: '2026-09-22T10:00:00Z',
  projectId: draft.projectId,
  draftId: draft.id,
  ...patch,
})

interface Options {
  transcripts?: Transcript[]
  liveSession?: SessionSummary | null
  templates?: Template[]
  otherDrafts?: DraftSummary[]
}

export function draftBackend(
  initial: Draft,
  { transcripts = [], liveSession: live = null, templates = [initial.template], otherDrafts = [] }: Options = {},
) {
  const state = { draft: initial, live, requests: [] as { method: string; path: string; body: unknown }[] }
  const { projectId, id: draftId } = initial
  const record = async (request: Request) => {
    const body = request.method === 'GET' ? undefined : await request.json().catch(() => undefined)
    state.requests.push({ method: request.method, path: new URL(request.url).pathname, body })
    return body
  }

  server.use(
    http.get(url(endpoints.project(projectId)), () =>
      HttpResponse.json({ id: projectId, name: 'Customer Portal', createdAt: '', tracker: 'azure-devops' }),
    ),
    http.get(url(endpoints.drafts(projectId)), () => HttpResponse.json(otherDrafts)),
    http.get(url(endpoints.glossary(projectId)), () => HttpResponse.json({ markdown: '', version: 'v0' })),
    http.get(url(endpoints.templates), () => HttpResponse.json(templates)),
    http.get(url(endpoints.draft(projectId, draftId)), () =>
      HttpResponse.json({ draft: state.draft, liveSession: state.live }),
    ),
    http.get(url(endpoints.draftSessions(projectId, draftId)), () => HttpResponse.json(transcripts)),
    http.get(url(endpoints.copyFields(projectId, draftId)), () => HttpResponse.json(copyFields(state.draft))),
    http.post(url(endpoints.draftOps(projectId, draftId)), async ({ request }) => {
      state.draft = applyHumanEdit(state.draft, (await record(request)) as HumanOp)
      return HttpResponse.json(state.draft)
    }),
    http.patch(url(endpoints.draftReferences(projectId, draftId)), async ({ request }) => {
      const { references } = (await record(request)) as { references: string[] }
      state.draft = { ...state.draft, references }
      return HttpResponse.json(state.draft)
    }),
    http.post(url(endpoints.decide(projectId, draftId)), async ({ request }) => {
      const { changeId, accept } = (await record(request)) as { changeId: string; accept: boolean }
      state.draft = decide(state.draft, changeId, accept, meta)
      return HttpResponse.json(state.draft)
    }),
    http.post(url(endpoints.acceptClean(projectId, draftId)), async ({ request }) => {
      await record(request)
      state.draft = acceptAllClean(state.draft, meta)
      return HttpResponse.json(state.draft)
    }),
    http.post(url(endpoints.draftSessions(projectId, draftId)), async ({ request }) => {
      const body = (await record(request)) as { kind: SessionSummary['kind'] }
      state.live = liveSession(state.draft, { id: 'sess-new', kind: body.kind, status: 'starting' })
      return HttpResponse.json(state.live)
    }),
    http.post(
      url(`${endpoints.draftSessions(projectId, draftId)}/:sessionId/continue`),
      async ({ request, params }) => {
        await record(request)
        state.live = liveSession(state.draft, {
          id: 'sess-new',
          status: 'starting',
          continues: String(params.sessionId),
        })
        return HttpResponse.json(state.live)
      },
    ),
    http.delete(url(endpoints.draft(projectId, draftId)), async ({ request }) => {
      await record(request)
      return HttpResponse.json({ ok: true })
    }),
    http.post('*/api/sessions/:sessionId/:action', async ({ request }) => {
      await record(request)
      return HttpResponse.json({ ok: true })
    }),
  )
  return state
}
