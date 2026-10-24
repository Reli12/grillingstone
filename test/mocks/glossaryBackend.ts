// A stateful fake of one Project's Glossary endpoints: it serves the current CONTEXT.md and, like the real
// server, refuses a save made against an older version with 409.
import { http, HttpResponse } from 'msw'

import type { GlossaryDoc } from '#core/contract/apiTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { server } from '@test/mocks/server'

export interface GlossarySave {
  markdown: string
  baseVersion: string
}

export interface GlossaryBackend {
  /** What the server holds now; assign it to play Claude or another tab changing the Glossary. */
  current: GlossaryDoc
  /** Every save the server accepted, oldest first. */
  saves: GlossarySave[]
  readonly lastSave: GlossarySave | undefined
}

export function glossaryBackend(projectId: string, markdown: string, projectName = 'Customer Portal'): GlossaryBackend {
  const backend: GlossaryBackend = {
    current: { markdown, version: 'v1' },
    saves: [],
    get lastSave() {
      return this.saves.at(-1)
    },
  }
  server.use(
    http.get(`*${endpoints.project(projectId)}`, () =>
      HttpResponse.json({ id: projectId, name: projectName, createdAt: '', tracker: 'azure-devops' }),
    ),
    http.get(`*${endpoints.glossary(projectId)}`, () => HttpResponse.json(backend.current)),
    http.put(`*${endpoints.glossary(projectId)}`, async ({ request }) => {
      const body = (await request.json()) as GlossarySave
      if (body.baseVersion !== backend.current.version)
        return HttpResponse.json({ error: 'The Glossary changed since you opened it.' }, { status: 409 })
      backend.saves.push(body)
      backend.current = { markdown: body.markdown, version: `${backend.current.version}+` }
      return HttpResponse.json(backend.current)
    }),
  )
  return backend
}
