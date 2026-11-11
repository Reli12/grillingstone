// Tests for the Azure DevOps Connection card: Test & save, a refused token, the write-only saved token, a rejected
// token, and a token from the environment.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { ConnectionStatus } from '#core/ado/adoTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { ConnectionCard } from '@/components/features/settings/connectionCard/connectionCard'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const connected: ConnectionStatus = {
  state: 'connected',
  orgUrl: 'https://dev.azure.com/acme',
  organization: 'acme',
  user: 'Dana Developer',
  fromEnvironment: false,
  storage: 'Saved encrypted for your Windows user.',
}

const status = (value: ConnectionStatus) =>
  server.use(http.get(`*${endpoints.connection}`, () => HttpResponse.json(value)))

describe('ConnectionCard', () => {
  it('tests and saves the URL and token, then shows who it acts as and never the token', async () => {
    const sent: unknown[] = []
    server.use(
      http.put(`*${endpoints.connection}`, async ({ request }) => {
        sent.push(await request.json())
        status(connected)
        return HttpResponse.json(connected)
      }),
    )
    const { user } = render(<ConnectionCard />)
    expect(await screen.findByText(/Not connected/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Organization URL'), 'https://dev.azure.com/acme')
    await user.type(screen.getByLabelText(/Personal Access Token/), 'pat-123')
    await user.click(screen.getByRole('button', { name: /Test & save/ }))
    expect(await screen.findByText(/Connected as Dana Developer to acme/)).toBeInTheDocument()
    expect(sent).toEqual([{ orgUrl: 'https://dev.azure.com/acme', token: 'pat-123' }])
    expect(screen.getByText('A token is saved')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('pat-123')).not.toBeInTheDocument()
  })

  it('shows why a token was refused', async () => {
    server.use(
      http.put(`*${endpoints.connection}`, () =>
        HttpResponse.json({ error: 'Azure DevOps rejected this token — nothing was saved.' }, { status: 422 }),
      ),
    )
    const { user } = render(<ConnectionCard />)
    await user.type(await screen.findByLabelText('Organization URL'), 'acme')
    await user.type(screen.getByLabelText(/Personal Access Token/), 'bad')
    await user.click(screen.getByRole('button', { name: /Test & save/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nothing was saved')
  })

  it('says the token was rejected, and lets it be replaced', async () => {
    status({ ...connected, state: 'rejected' })
    const { user } = render(<ConnectionCard />)
    expect(await screen.findByText(/Token rejected/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    expect(screen.getByLabelText(/Personal Access Token/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeEnabled()
  })

  it('is read-only with a token from the environment', async () => {
    status({ ...connected, fromEnvironment: true, storage: 'Using the token from GRILLINGSTONE_ADO_PAT.' })
    render(<ConnectionCard />)
    expect(await screen.findByText(/GRILLINGSTONE_ADO_PAT/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Personal Access Token/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Test & save/ })).not.toBeInTheDocument()
  })
})
