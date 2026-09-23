import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ws } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/api/reactQueryKeys'
import { ServerEventsProvider, useBackendConnection } from '@/context/ServerEvents/ServerEvents'
import { server } from '@test/mocks/server'
import { createTestQueryClient } from '@test/utils/testUtils'

const socket = ws.link('ws://*/api/ws')

function Status() {
  return <p>{useBackendConnection()}</p>
}

function renderProvider() {
  const qc = createTestQueryClient()
  qc.setQueryData(queryKeys.templates, [])
  render(
    <QueryClientProvider client={qc}>
      <ServerEventsProvider>
        <Status />
      </ServerEventsProvider>
    </QueryClientProvider>,
  )
  return qc
}

describe('ServerEventsProvider', () => {
  it('connects and folds events into the cache, ignoring malformed ones', async () => {
    server.use(
      socket.addEventListener('connection', ({ client }) => {
        client.send('not json')
        client.send(JSON.stringify({ type: 'templates' }))
      }),
    )
    const qc = renderProvider()
    expect(screen.getByText('connecting')).toBeInTheDocument()
    expect(await screen.findByText('open')).toBeInTheDocument()
    await vi.waitFor(() => expect(qc.getQueryState(queryKeys.templates)?.isInvalidated).toBe(true))
  })

  it('reports a lost backend, reconnects and refetches everything', async () => {
    let connections = 0
    server.use(
      socket.addEventListener('connection', ({ client }) => {
        if (++connections === 1) client.close()
      }),
    )
    const qc = renderProvider()
    expect(await screen.findByText('closed')).toBeInTheDocument()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    expect(await screen.findByText('open', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith()
  })
})
