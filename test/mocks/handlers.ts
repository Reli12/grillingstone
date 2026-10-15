// Default MSW handlers: a quiet backend with one Project and default Settings. Tests override
// individual routes with `server.use(...)`.
import { http, HttpResponse } from 'msw'

import type { ProjectSummary, SettingsView } from '#core/contract/apiTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'

export const settingsFixture: SettingsView = {
  author: 'dorijan',
  assistant: 'claude',
  models: { claude: '', codex: '' },
  theme: 'system',
  availability: { claude: { ready: true }, codex: { ready: true } },
}
export const projectsFixture: ProjectSummary[] = [
  { id: 'customer-portal', name: 'Customer Portal', createdAt: '2026-09-22', drafts: 2 },
]

const url = (path: string) => `*${path}`

export const handlers = [
  http.get(url(endpoints.settings), () => HttpResponse.json(settingsFixture)),
  // Like the backend: the saved Settings, answered with each Assistant's availability.
  http.put(url(endpoints.settings), async ({ request }) =>
    HttpResponse.json({ ...((await request.json()) as object), availability: settingsFixture.availability }),
  ),
  http.get(url(endpoints.projects), () => HttpResponse.json(projectsFixture)),
  http.get(url(endpoints.templates), () => HttpResponse.json([defaultPbiTemplate])),
]
