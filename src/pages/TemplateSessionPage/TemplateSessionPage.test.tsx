// Tests for TemplateSessionPage: a live session, its saved Template, an ended one and the load error.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { TemplateTranscript } from '#core/session/sessionTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { queryKeys } from '@/api/reactQueryKeys'
import TemplateSessionPage from '@/pages/TemplateSessionPage/TemplateSessionPage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const transcript = (patch: Partial<TemplateTranscript> = {}): TemplateTranscript => ({
  id: 'ts',
  kind: 'template',
  status: 'waiting',
  writeConfirmed: false,
  startedAt: '',
  request: { workItemType: 'PBI', purpose: 'Spike PBIs', examples: '', baseTemplateName: 'Default PBI Template' },
  messages: [
    {
      id: 'm1',
      at: '',
      role: 'claude',
      segments: [{ type: 'question', question: 'Timebox?', recommended: '2 days', options: [] }],
    },
  ],
  ...patch,
})

const serve = (transcript: TemplateTranscript) =>
  server.use(http.get(`*${endpoints.templateSession('ts')}`, () => HttpResponse.json(transcript)))
const renderPage = () =>
  render(<TemplateSessionPage />, { route: '/templates/session/ts', path: '/templates/session/:sessionId' })

describe('TemplateSessionPage', () => {
  it('runs a live Template Session', async () => {
    serve(transcript())
    const sent: unknown[] = []
    server.use(
      http.post('*/api/sessions/ts/:action', async ({ request, params }) => {
        sent.push([params.action, await request.json()])
        return HttpResponse.json({ ok: true })
      }),
    )
    const { user } = renderPage()
    expect(await screen.findByText(/starting from the Default PBI Template/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Recommended/ }))
    await user.type(screen.getByRole('textbox', { name: 'Message Claude' }), 'And a spike label{Enter}')
    await user.click(screen.getByRole('button', { name: 'Enough — write it' }))
    await user.click(screen.getByRole('button', { name: /Stop/ }))
    await vi.waitFor(() =>
      expect(sent.map((call) => (call as string[])[0])).toEqual(['messages', 'messages', 'write', 'stop']),
    )
  })

  it('opens the editor once the session saves its Template', async () => {
    serve(transcript())
    const { queryClient } = renderPage()
    await screen.findByText('Timebox?')
    queryClient.setQueryData(queryKeys.templateSession('ts'), transcript({ status: 'finished', templateId: 't1' }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
  })

  it('links to the Template a finished session made', async () => {
    serve(transcript({ status: 'finished', templateId: 't1' }))
    renderPage()
    expect(await screen.findByText('This session created a Template.')).toBeInTheDocument()
  })

  it('offers a new session when one ended without a Template', async () => {
    serve(transcript({ status: 'stopped' }))
    renderPage()
    expect(await screen.findByText(/ended without a Template/)).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    server.use(
      http.get(`*${endpoints.templateSession('ts')}`, () =>
        HttpResponse.json({ error: 'Unknown session' }, { status: 404 }),
      ),
    )
    renderPage()
    expect(await screen.findByText('Unknown session')).toBeInTheDocument()
  })
})
