// Tests for ProjectPage: the empty state, renaming the Project and the load error.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import ProjectPage from '@/pages/ProjectPage/ProjectPage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const project = { id: 'customer-portal', name: 'Customer Portal', createdAt: '2026-09-22' }
const renderPage = () => render(<ProjectPage />, { route: '/p/customer-portal', path: '/p/:projectId' })

describe('ProjectPage', () => {
  beforeEach(() =>
    server.use(
      http.get(`*${endpoints.project('customer-portal')}`, () => HttpResponse.json(project)),
      http.get(`*${endpoints.drafts('customer-portal')}`, () => HttpResponse.json([])),
      http.get(`*${endpoints.glossary('customer-portal')}`, () => HttpResponse.json({ markdown: '', version: 'v0' })),
    ),
  )

  it('shows an empty Project with a way to start', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Customer Portal' })).toBeInTheDocument()
    expect(screen.getByText('No Drafts in this Project yet')).toBeInTheDocument()
  })

  it('renames the Project on double-click', async () => {
    let sent: unknown
    server.use(
      http.patch(`*${endpoints.project('customer-portal')}`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ ...project, name: 'Portal' })
      }),
    )
    const { user } = renderPage()
    await user.dblClick(await screen.findByRole('heading', { name: 'Customer Portal' }))
    const input = screen.getByRole('textbox', { name: 'Project name' })
    await user.clear(input)
    await user.type(input, 'Portal{Enter}')

    await vi.waitFor(() => expect(sent).toEqual({ name: 'Portal' }))
    expect(await screen.findByRole('heading', { name: 'Customer Portal' })).toBeInTheDocument()
  })

  it('keeps editing when the new name is blank', async () => {
    const { user } = renderPage()
    await user.dblClick(await screen.findByRole('heading', { name: 'Customer Portal' }))
    const input = screen.getByRole('textbox', { name: 'Project name' })
    await user.clear(input)
    await user.type(input, '{Enter}')
    expect(screen.getByRole('textbox', { name: 'Project name' })).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    server.use(
      http.get(`*${endpoints.project('customer-portal')}`, () =>
        HttpResponse.json({ error: 'No such Project' }, { status: 404 }),
      ),
    )
    renderPage()
    expect(await screen.findByText('No such Project')).toBeInTheDocument()
  })
})
