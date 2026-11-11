// Tests for ProjectPage: the empty state, renaming the Project, the load error, and the Drafts board and Glossary tabs.
import { Route, Routes } from 'react-router'

import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addTerm } from '#core/glossary/glossary.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import ProjectPage from '@/pages/ProjectPage/ProjectPage'
import { routesPaths } from '@/routes/routes'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const project = { id: 'customer-portal', name: 'Customer Portal', createdAt: '2026-09-22' }
const glossary = addTerm('', { term: 'Device', definition: 'A metered unit.', avoid: '' }, 'Customer Portal')
const renderPage = (route = '/p/customer-portal') =>
  render(
    <Routes>
      <Route path={routesPaths.project(':projectId')} element={<ProjectPage />} />
      <Route path={routesPaths.projectGlossary(':projectId')} element={<ProjectPage />} />
    </Routes>,
    { route },
  )

/** The Project holds one Draft, updated just now so the board's last-week default shows it. */
const withADraft = () =>
  server.use(
    http.get(`*${endpoints.drafts('customer-portal')}`, () =>
      HttpResponse.json([
        {
          id: 'd1',
          projectId: 'customer-portal',
          title: 'Archive devices',
          requirement: 'Managers archive devices.',
          workItemType: 'PBI',
          version: 1,
          templateName: 'Default PBI Template',
          pendingChanges: 0,
          changedBacklogCopies: [],
          lane: 'review',
          archived: false,
          updatedAt: new Date().toISOString(),
        },
      ]),
    ),
  )

describe('ProjectPage', () => {
  beforeEach(() =>
    server.use(
      http.get(`*${endpoints.project('customer-portal')}`, () => HttpResponse.json(project)),
      http.get(`*${endpoints.drafts('customer-portal')}`, () => HttpResponse.json([])),
      http.get(`*${endpoints.glossary('customer-portal')}`, () =>
        HttpResponse.json({ markdown: glossary, version: 'v1' }),
      ),
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

  it('shows the Drafts board with a link to the Glossary at the Project URL', async () => {
    withADraft()
    renderPage()
    expect(await screen.findByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('region', { name: 'In review' })).toHaveTextContent('Archive devices')
    expect(screen.queryByRole('button', { name: /Add term/ })).not.toBeInTheDocument()
  })

  it('opens the whole Glossary from the board, and the Glossary tab at its own URL', async () => {
    withADraft()
    const { user } = renderPage()
    await user.click(await screen.findByRole('link', { name: /Open Glossary/ }))
    expect(await screen.findByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add term/ })).toBeInTheDocument()
  })

  it('switches back to the Drafts tab', async () => {
    withADraft()
    const { user } = renderPage('/p/customer-portal/glossary')
    await user.click(await screen.findByRole('tab', { name: 'Drafts' }))
    expect(await screen.findByRole('link', { name: /Open Glossary/ })).toBeInTheDocument()
  })
})
