// Tests for a Project's Settings tab: Azure DevOps sections only for Azure DevOps Projects, the Backlog's check &
// save with its refusal, removing it after a confirmation, and the Backlog fixed once a Draft is linked, with the
// linked Drafts listed to Unlink.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { DraftSummary, Project } from '#core/contract/apiTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { ProjectSettings } from '@/components/features/projects/projectSettings/projectSettings'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const project: Project = { id: 'fleet', name: 'Fleet', createdAt: '2026-11-01', tracker: 'azure-devops' }

const connected = () =>
  server.use(
    http.get(`*${endpoints.connection}`, () =>
      HttpResponse.json({
        state: 'connected',
        organization: 'acme',
        user: 'Dana',
        fromEnvironment: false,
        storage: '',
      }),
    ),
  )

const linkedDraft = {
  id: 'd-1',
  projectId: 'fleet',
  title: 'Archive device',
  requirement: '',
  archived: false,
  linkedWorkItem: { id: 9, url: 'u' },
} as DraftSummary

describe('ProjectSettings', () => {
  it('shows only the Tracker for a Jira Project', () => {
    render(<ProjectSettings project={{ ...project, tracker: 'jira' }} drafts={[]} />)
    expect(screen.getByRole('button', { name: /Tracker/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Backlog/ })).not.toBeInTheDocument()
  })

  it('checks and saves the Backlog, showing why one is refused', async () => {
    connected()
    server.use(
      http.put(`*${endpoints.projectBacklog('fleet')}`, async ({ request }) => {
        const { name } = (await request.json()) as { name: string }
        if (name === 'Legacy CRM')
          return HttpResponse.json({ error: 'Legacy CRM has no Product Backlog Item.' }, { status: 422 })
        return HttpResponse.json({ ...project, backlog: 'Customer Portal' })
      }),
    )
    const { user } = render(<ProjectSettings project={project} drafts={[]} />)
    expect(screen.getByText('Not set')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Backlog/ }))
    const field = await screen.findByLabelText('Azure DevOps project')
    await user.type(field, 'Legacy CRM')
    await user.click(screen.getByRole('button', { name: 'Check & save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no Product Backlog Item')
    await user.clear(field)
    await user.type(field, 'customer portal')
    await user.click(screen.getByRole('button', { name: 'Check & save' }))
    await screen.findByRole('button', { name: 'Check & save' })
  })

  it('fixes the Backlog once a Draft is linked', async () => {
    connected()
    const { user } = render(
      <ProjectSettings project={{ ...project, backlog: 'Customer Portal' }} drafts={[linkedDraft]} />,
    )
    await user.click(screen.getByRole('button', { name: /Backlog/ }))
    expect(await screen.findByText(/Fixed: this Draft has a Linked Work Item in Customer Portal/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Archive device' })).toBeInTheDocument()

    let unlinked = false
    server.use(
      http.delete(`*${endpoints.draftLink('fleet', 'd-1')}`, () => {
        unlinked = true
        return HttpResponse.json({ ...linkedDraft, linkedWorkItem: undefined })
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Unlink #9' }))
    await vi.waitFor(() => expect(unlinked).toBe(true))
  })

  it('removes the Backlog only after a confirmation', async () => {
    connected()
    let removed = false
    server.use(
      http.delete(`*${endpoints.projectBacklog('fleet')}`, () => {
        removed = true
        return HttpResponse.json(project)
      }),
    )
    const { user } = render(<ProjectSettings project={{ ...project, backlog: 'Customer Portal' }} drafts={[]} />)
    await user.click(screen.getByRole('button', { name: /Backlog/ }))
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(screen.getByText(/Publish and Import turn off/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(removed).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Remove Backlog' }))
    await vi.waitFor(() => expect(removed).toBe(true))
  })
})
