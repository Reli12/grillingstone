// A stateful fake of one Project's Backlog Copy endpoints: it lists, pastes (refusing a work item already copied
// with 409, like the real server), re-pastes and deletes, and records every request it accepted.
import { http, HttpResponse } from 'msw'

import type { BacklogCopy, PastedCopy, Repaste } from '#core/backlog/backlogCopy.ts'
import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { server } from '@test/mocks/server'

export interface BacklogBackend {
  summaries: BacklogCopySummary[]
  created: PastedCopy[]
  repasted: { copyId: string; repaste: Repaste }[]
  deleted: string[]
}

export const backlogCopyFixture = (patch: Partial<BacklogCopy> = {}): BacklogCopy => ({
  id: 'ado-1234',
  workItemId: 1234,
  workItemType: 'Feature',
  title: 'Device archiving',
  url: 'https://dev.azure.com/acme/fleet/_workitems/edit/1234',
  content: 'BR1 — A Manager can archive a device.',
  acceptanceCriteria: 'AC1 — Archived devices leave dashboards.',
  revision: 1,
  pastedAt: '2026-11-04T10:00:00.000Z',
  ...patch,
})

const idOf = (workItem: string) => Number(/(\d+)\/?$/.exec(workItem.trim())?.[1] ?? Number.NaN)

export function backlogBackend(projectId: string, summaries: BacklogCopySummary[] = []): BacklogBackend {
  const backend: BacklogBackend = { summaries, created: [], repasted: [], deleted: [] }
  server.use(
    http.get(`*${endpoints.backlogCopies(projectId)}`, () => HttpResponse.json(backend.summaries)),
    http.post(`*${endpoints.backlogCopies(projectId)}`, async ({ request }) => {
      const pasted = (await request.json()) as PastedCopy
      const workItemId = idOf(pasted.workItem)
      if (backend.summaries.some((summary) => summary.copy.workItemId === workItemId))
        return HttpResponse.json(
          { error: `Work item #${workItemId} is already a Backlog Copy in this Project — re-paste it instead.` },
          { status: 409 },
        )
      backend.created.push(pasted)
      const copy = backlogCopyFixture({
        id: `ado-${workItemId}`,
        workItemId,
        title: pasted.title,
        content: pasted.content,
      })
      backend.summaries = [...backend.summaries, { copy, drafts: [] }]
      return HttpResponse.json(copy)
    }),
    http.put(`*${endpoints.backlogCopies(projectId)}/:copyId`, async ({ request, params }) => {
      const repaste = (await request.json()) as Repaste
      const copyId = String(params.copyId)
      backend.repasted.push({ copyId, repaste })
      return HttpResponse.json(backend.summaries.find((summary) => summary.copy.id === copyId)?.copy)
    }),
    http.delete(`*${endpoints.backlogCopies(projectId)}/:copyId`, ({ params }) => {
      backend.deleted.push(String(params.copyId))
      backend.summaries = backend.summaries.filter((summary) => summary.copy.id !== params.copyId)
      return HttpResponse.json({ ok: true })
    }),
  )
  return backend
}
