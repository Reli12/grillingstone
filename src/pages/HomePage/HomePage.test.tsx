// Tests for HomePage: the Project list, the first-run welcome and creating a Project with its Glossary.
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import HomePage from '@/pages/HomePage/HomePage'
import { settingsFixture } from '@test/mocks/handlers'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

describe('HomePage', () => {
  it('lists Projects', async () => {
    render(<HomePage />, { path: '/' })
    expect(await screen.findByRole('link', { name: /Customer Portal/ })).toBeInTheDocument()
    expect(screen.getByText('2 Drafts')).toBeInTheDocument()
  })

  it('welcomes a first-time user', async () => {
    server.use(http.get(`*${endpoints.projects}`, () => HttpResponse.json([])))
    render(<HomePage />, { path: '/' })
    expect(await screen.findByText('Grill a requirement into a work item.')).toBeInTheDocument()
  })

  const capture = () => {
    const sent: unknown[] = []
    server.use(
      http.post(`*${endpoints.projects}`, async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ id: 'billing', name: 'Billing', createdAt: '', tracker: 'azure-devops' })
      }),
    )
    return sent
  }
  const openDialog = async (user: ReturnType<typeof render>['user']) => {
    await user.click(await screen.findByRole('button', { name: 'New Project' }))
    return within(screen.getByRole('dialog'))
  }

  it('creates a Project with an empty Glossary and opens it', async () => {
    const sent = capture()
    const { user } = render(<HomePage />, { path: '/' })
    const dialog = await openDialog(user)
    const create = dialog.getByRole('button', { name: 'Create Project' })
    expect(create).toBeDisabled()
    expect(dialog.getByRole('radio', { name: /Empty/ })).toBeChecked()

    await user.type(dialog.getByRole('textbox', { name: 'Project name' }), '  Billing ')
    await user.click(create)

    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
    expect(sent).toEqual([{ name: 'Billing', tracker: 'azure-devops' }])
  })

  it('preselects the Default Tracker and sends the Tracker the human picks', async () => {
    const sent = capture()
    server.use(
      http.get(`*${endpoints.settings}`, () => HttpResponse.json({ ...settingsFixture, defaultTracker: 'jira' })),
    )
    const { user } = render(<HomePage />, { path: '/' })
    const dialog = await openDialog(user)
    const trackers = within(dialog.getByRole('radiogroup', { name: 'Tracker' }))
    await vi.waitFor(() =>
      expect(trackers.getByRole('radio', { name: 'Jira' })).toHaveAttribute('aria-checked', 'true'),
    )
    expect(dialog.getByText(/Epic · Story · Task · Sub-task · Bug\. Your default from Settings\./)).toBeInTheDocument()

    await user.type(dialog.getByRole('textbox', { name: 'Project name' }), 'Billing')
    await user.click(trackers.getByRole('radio', { name: 'Azure DevOps' }))
    expect(dialog.getByText(/Epic · Feature · PBI · Task · Bug\. Fixed once/)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Create Project' }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
    expect(sent).toEqual([{ name: 'Billing', tracker: 'azure-devops' }])
  })

  it('starts from pasted text, titled with the Project name, and says which terms it recognised', async () => {
    const sent = capture()
    const { user } = render(<HomePage />, { path: '/' })
    const dialog = await openDialog(user)
    await user.type(dialog.getByRole('textbox', { name: 'Project name' }), 'Billing')
    await user.click(dialog.getByRole('radio', { name: /From text I have/ }))

    const text = dialog.getByRole('textbox', { name: 'Starting Glossary' })
    await user.click(text)
    await user.paste('Invoices only')
    expect(dialog.getByText(/No terms in the Glossary format were found/)).toBeInTheDocument()

    await user.clear(text)
    await user.paste('# Old\n\n## Language\n\n**Invoice**:\nA request for payment.\n')
    expect(dialog.getByText('# Billing')).toBeInTheDocument()
    expect(dialog.getByText(/1 term recognised/)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Create Project' }))

    await vi.waitFor(() =>
      expect(sent).toEqual([
        {
          name: 'Billing',
          tracker: 'azure-devops',
          glossary: '# Billing\n\n## Language\n\n**Invoice**:\nA request for payment.\n',
        },
      ]),
    )
  })

  it('starts as a copy of another Project’s Glossary', async () => {
    const sent = capture()
    server.use(
      http.get(`*${endpoints.glossary('customer-portal')}`, () =>
        HttpResponse.json({
          markdown: '# Customer Portal\n\nDevices.\n\n## Language\n\n**Site**:\nA place.\n',
          version: 'v1',
        }),
      ),
    )
    const { user } = render(<HomePage />, { path: '/' })
    const dialog = await openDialog(user)
    await user.type(dialog.getByRole('textbox', { name: 'Project name' }), 'Billing')
    await user.click(dialog.getByRole('radio', { name: /copy of a Project/ }))
    await user.selectOptions(dialog.getByRole('combobox', { name: 'Copy from Project' }), 'customer-portal')

    expect(await dialog.findByText(/1 term recognised/)).toBeInTheDocument()
    expect(dialog.getByRole('textbox', { name: 'Starting Glossary' })).toHaveValue(
      'Devices.\n\n## Language\n\n**Site**:\nA place.\n',
    )
    await user.click(dialog.getByRole('button', { name: 'Create Project' }))
    await vi.waitFor(() =>
      expect(sent).toEqual([
        {
          name: 'Billing',
          tracker: 'azure-devops',
          glossary: '# Billing\n\nDevices.\n\n## Language\n\n**Site**:\nA place.\n',
        },
      ]),
    )
  })

  it('opens straight into the dialog from the header’s New Project link', async () => {
    render(<HomePage />, { route: '/?newProject', path: '/' })
    expect(await screen.findByRole('dialog')).toHaveTextContent('New Project')
  })

  it('offers no copy when there is no other Project, and no Project with a blank name', async () => {
    server.use(http.get(`*${endpoints.projects}`, () => HttpResponse.json([])))
    const { user } = render(<HomePage />, { path: '/' })
    const dialog = await openDialog(user)
    expect(dialog.queryByRole('radio', { name: /copy of a Project/ })).not.toBeInTheDocument()
    await user.type(dialog.getByRole('textbox', { name: 'Project name' }), '   ')
    expect(dialog.getByRole('button', { name: 'Create Project' })).toBeDisabled()
  })
})
