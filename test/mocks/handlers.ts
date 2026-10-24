// Default MSW handlers: a quiet backend with one Project and default Settings. Tests override
// individual routes with `server.use(...)`.
import { http, HttpResponse } from 'msw'

import type { ProjectSummary, Settings } from '#core/contract/apiTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'

export const settingsFixture: Settings = {
  author: 'dorijan',
  model: '',
  theme: 'system',
  defaultTracker: 'azure-devops',
}
export const projectsFixture: ProjectSummary[] = [
  { id: 'customer-portal', name: 'Customer Portal', createdAt: '2026-09-22', tracker: 'azure-devops', drafts: 2 },
]

const url = (path: string) => `*${path}`

export const handlers = [
  http.get(url(endpoints.settings), () => HttpResponse.json(settingsFixture)),
  http.put(url(endpoints.settings), async ({ request }) => HttpResponse.json(await request.json())),
  http.get(url(endpoints.projects), () => HttpResponse.json(projectsFixture)),
  http.get(url(endpoints.templates), () => HttpResponse.json([defaultPbiTemplate])),
]
