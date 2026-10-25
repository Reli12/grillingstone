// Tests for ProjectPage: the empty state, renaming the Project, the load error, and the Drafts and Glossary tabs.
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
      <Route path={routesPaths.projectPrototypes(':projectId')} element={<ProjectPage />} />
    </Routes>,
    { route },
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

  it('shows the Drafts tab with a read-only Glossary preview at the Project URL', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('link', { name: 'Device' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add term/ })).not.toBeInTheDocument()
  })

  it('opens the whole Glossary from the preview, and the Glossary tab at its own URL', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('link', { name: /Open Glossary/ }))
    expect(await screen.findByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add term/ })).toBeInTheDocument()
  })

  it('opens the Prototypes tab at its own URL and lists the Project’s Prototypes', async () => {
    server.use(http.get(`*${endpoints.projectPrototypes('customer-portal')}`, () => HttpResponse.json([])))
    const { user } = renderPage()
    await user.click(await screen.findByRole('tab', { name: 'Prototypes' }))

    expect(await screen.findByRole('tab', { name: 'Prototypes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toHaveAttribute('href', '/p/customer-portal/prototypes')
    expect(await screen.findByText('No Prototypes yet')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows the Prototypes tab when opened by its URL', async () => {
    server.use(http.get(`*${endpoints.projectPrototypes('customer-portal')}`, () => HttpResponse.json([])))
    renderPage('/p/customer-portal/prototypes')
    expect(await screen.findByRole('button', { name: '+ New Prototype' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches back to the Drafts tab', async () => {
    const { user } = renderPage('/p/customer-portal/glossary')
    await user.click(await screen.findByRole('tab', { name: 'Drafts' }))
    expect(await screen.findByRole('link', { name: /Open Glossary/ })).toBeInTheDocument()
  })
})
