// Tests for AppLayout: the header's Project switcher, New Project link and home link, and the footer.
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import { rememberProject } from '@/lib/lastProject'
import AppLayout from '@/pages/AppLayout'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const projects = [
  { id: 'customer-portal', name: 'Customer Portal', createdAt: '', drafts: 2 },
  { id: 'billing', name: 'Billing', createdAt: '', drafts: 1 },
]

describe('AppLayout', () => {
  it('switches Projects from the header and remembers the last one', async () => {
    server.use(http.get(`*${endpoints.projects}`, () => HttpResponse.json(projects)))
    const { user } = render(<AppLayout />, { route: '/p/customer-portal', path: '/p/:projectId' })

    await user.click(await screen.findByRole('button', { name: /Customer Portal/ }))
    expect(screen.getByRole('button', { name: /1 Draft$/ })).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('button', { name: /1 Draft$/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Customer Portal/ }))
    expect(localStorage.getItem('pbi.lastProject')).toBe('customer-portal')
    await user.click(screen.getByRole('button', { name: /Billing/ }))
    expect(await screen.findByRole('button', { name: 'Billing' })).toHaveAttribute('aria-expanded', 'false')
    expect(localStorage.getItem('pbi.lastProject')).toBe('billing')
  })

  it('offers a new Project and links home to the Project list, even with a Project remembered', async () => {
    rememberProject('billing')
    server.use(http.get(`*${endpoints.projects}`, () => HttpResponse.json(projects)))
    const { user } = render(<AppLayout />, { route: '/settings', path: '/settings' })
    expect(screen.getByRole('link', { name: 'Grilling Stone' })).toHaveAttribute('href', '/')
    await user.click(await screen.findByRole('button', { name: /Billing/ }))
    await user.click(screen.getByRole('button', { name: /New Project/ }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
  })

  it('ends every page with the copyright and a link to the Legal page', () => {
    server.use(http.get(`*${endpoints.projects}`, () => HttpResponse.json([])))
    render(<AppLayout />, { route: '/', path: '/' })
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('© 2026 Dorijan Polanc · MIT License')
    expect(within(footer).getByRole('link', { name: 'Legal' })).toHaveAttribute('href', '/legal')
  })

  it('hides the switcher without Projects', () => {
    server.use(http.get(`*${endpoints.projects}`, () => HttpResponse.json([])))
    render(<AppLayout />, { route: '/', path: '/' })
    expect(screen.getByRole('link', { name: 'Grilling Stone' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })
})
