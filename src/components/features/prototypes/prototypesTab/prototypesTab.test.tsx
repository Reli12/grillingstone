// Tests for the Draft side panel's Prototypes tab: a row for every kind with its actions, 'New Prototype' and its
// start form, the "started from" labels, the empty state, and rows that follow the server's events.
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PrototypeRow } from '#core/prototype/prototypeRecords.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { queryKeys } from '@/api/reactQueryKeys'
import { PrototypesTab } from '@/components/features/prototypes/prototypesTab/prototypesTab'
import { draftImageOf, finishedRow, prototypeBackend, sessionOf } from '@test/mocks/prototypeBackend'
import { render } from '@test/utils/testUtils'

const draft = v1Draft()
const renderTab = () => render(<PrototypesTab projectId={draft.projectId} draftId={draft.id} />)

const running: PrototypeRow = { kind: 'running', session: sessionOf(draft) }
const stopped: PrototypeRow = { kind: 'stopped', session: sessionOf(draft, { id: 'psess-3', status: 'stopped' }) }
const failed: PrototypeRow = {
  kind: 'failed',
  session: sessionOf(draft, { id: 'psess-2', status: 'failed', error: 'Claude Code exited with code 3\nstack…' }),
  messages: [
    { id: 'm1', at: '', role: 'system', text: 'Prototype Session started' },
    { id: 'm2', at: '', role: 'claude', segments: [{ type: 'text', text: 'I could not finish.' }] },
  ],
}

describe('PrototypesTab rows', () => {
  it('shows a running row with Stop, and stops the session', async () => {
    const api = prototypeBackend(draft, { rows: [running] })
    const { user } = renderTab()

    expect(await screen.findByText(/Being written/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await vi.waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'POST',
        path: `/api/projects/${draft.projectId}/prototype-sessions/psess-1/stop`,
        body: {},
      }),
    )
  })

  it('shows a Failed row with a short reason and a Details toggle for Claude’s last messages', async () => {
    prototypeBackend(draft, { rows: [failed] })
    const { user } = renderTab()

    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Claude Code exited with code 3')).toBeInTheDocument()
    expect(screen.queryByText('I could not finish.')).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('I could not finish.')).toBeInTheDocument()
    expect(screen.getByText('Prototype Session started')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.queryByText('I could not finish.')).not.toBeInTheDocument()
  })

  it('shows a Stopped row', async () => {
    prototypeBackend(draft, { rows: [stopped] })
    renderTab()
    expect(await screen.findByText('Stopped')).toBeInTheDocument()
    expect(screen.getByText(/Nothing was kept/)).toBeInTheDocument()
  })

  it('shows a finished row with its Draft version and time, opening in a new browser tab', async () => {
    prototypeBackend(draft, { rows: [finishedRow(draft, { draftVersion: 2 })] })
    renderTab()

    const link = await screen.findByRole('link', { name: /^v2 · / })
    expect(link).toHaveAttribute('href', `/p/${draft.projectId}/prototypes/proto-1`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
    expect(screen.getByText('1 assumption')).toBeInTheDocument()
  })

  it('names the Prototype a finished one started from, or says it was deleted', async () => {
    const rows = [
      finishedRow(draft, { id: 'proto-3', draftVersion: 3, startingPrototypeId: 'proto-2' }),
      finishedRow(draft, { id: 'proto-2', draftVersion: 2, startingPrototypeId: 'proto-gone' }),
      finishedRow(draft, { id: 'proto-1', draftVersion: 1 }),
    ]
    prototypeBackend(draft, { rows })
    renderTab()

    const items = await screen.findAllByRole('listitem')
    expect(within(items[0]).getByText(/^started from v2 · /)).toBeInTheDocument()
    expect(within(items[1]).getByText('started from a deleted Prototype')).toBeInTheDocument()
    expect(within(items[2]).queryByText(/started from/)).not.toBeInTheDocument()
  })

  it('updates by itself when the server says the Prototypes changed', async () => {
    const api = prototypeBackend(draft, { rows: [running] })
    const { queryClient } = renderTab()
    expect(await screen.findByText(/Being written/)).toBeInTheDocument()

    api.rows = [finishedRow(draft, { draftVersion: 1 })]
    await queryClient.invalidateQueries({ queryKey: queryKeys.prototypes(draft.projectId) })

    expect(await screen.findByRole('link', { name: /^v1 · / })).toBeInTheDocument()
    expect(screen.queryByText(/Being written/)).not.toBeInTheDocument()
  })
})

describe('PrototypesTab row actions', () => {
  const finished = finishedRow(draft, { id: 'proto-1' })

  it('offers each kind of row its own actions', async () => {
    prototypeBackend(draft, { rows: [running, failed, stopped, finished] })
    renderTab()

    const [runningItem, failedItem, stoppedItem, finishedItem] = await screen.findAllByRole('listitem')
    const buttons = (item: HTMLElement) =>
      within(item)
        .queryAllByRole('button')
        .map((button) => button.textContent)

    expect(buttons(runningItem)).toEqual(['Stop'])
    expect(buttons(failedItem)).toEqual(['Details', 'Try again', 'Dismiss'])
    expect(buttons(stoppedItem)).toEqual(['Try again', 'Dismiss'])
    expect(buttons(finishedItem)).toEqual(['Delete'])
    expect(within(finishedItem).getByRole('link', { name: 'Download' })).toBeInTheDocument()
    expect(within(failedItem).queryByRole('link', { name: 'Download' })).not.toBeInTheDocument()
  })

  it('downloads a finished Prototype through the view route', async () => {
    prototypeBackend(draft, { rows: [finished] })
    renderTab()
    const link = await screen.findByRole('link', { name: 'Download' })
    expect(link).toHaveAttribute('href', `/api/projects/${draft.projectId}/prototypes/proto-1/view?download=1`)
  })

  it('Dismiss removes a Failed row and a Stopped row', async () => {
    const api = prototypeBackend(draft, { rows: [failed, stopped] })
    const { user } = renderTab()

    const [failedItem] = await screen.findAllByRole('listitem')
    await user.click(within(failedItem).getByRole('button', { name: 'Dismiss' }))
    await vi.waitFor(() => expect(screen.queryByText('Failed')).not.toBeInTheDocument())
    expect(api.requests).toContainEqual({
      method: 'DELETE',
      path: `/api/projects/${draft.projectId}/prototype-sessions/psess-2`,
      body: {},
    })

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(await screen.findByText('No Prototypes yet')).toBeInTheDocument()
  })

  it('does not offer Try again while a Prototype is being written for the Draft', async () => {
    prototypeBackend(draft, { rows: [running, failed] })
    renderTab()
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeDisabled()
  })

  it('Try again reopens the start form with the same ticked Images, extra Images and starting Prototype', async () => {
    const inputs = {
      'psess-2': {
        tickedImages: [{ sessionId: 'sess-first', number: 2 }],
        extraImages: [{ mediaType: 'image/png' as const, data: 'AAAA' }],
        startingPrototypeId: 'proto-1',
      },
    }
    const images = [draftImageOf(1), draftImageOf(2)]
    const api = prototypeBackend(draft, { rows: [failed, finished], images, inputs })
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    const boxes = await screen.findAllByRole('checkbox')
    expect(boxes[0]).not.toBeChecked()
    expect(boxes[1]).toBeChecked()
    expect(screen.getByRole('img', { name: 'Image 1' })).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    expect(screen.getByRole('combobox', { name: /earlier Prototype/ })).toHaveValue('proto-1')

    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          body: {
            tickedImages: [{ sessionId: 'sess-first', number: 2 }],
            extraImages: [{ mediaType: 'image/png', data: 'AAAA' }],
            startingPrototypeId: 'proto-1',
          },
        }),
      ),
    )
  })

  it('Try again leaves out a starting Prototype that was deleted since', async () => {
    const inputs = { 'psess-2': { tickedImages: [], extraImages: [], startingPrototypeId: 'proto-gone' } }
    const api = prototypeBackend(draft, { rows: [failed], inputs })
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(expect.objectContaining({ method: 'POST', body: { tickedImages: [] } })),
    )
  })
})

describe('PrototypesTab Delete', () => {
  const finished = finishedRow(draft, { id: 'proto-1' })

  it('asks first, and Cancel keeps the Prototype', async () => {
    const api = prototypeBackend(draft, { rows: [finished] })
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this Prototype?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^v1 · / })).toBeInTheDocument()
    expect(api.requests.filter((request) => request.method === 'DELETE')).toEqual([])
  })

  it('deletes the Prototype once confirmed, and the row is gone', async () => {
    const api = prototypeBackend(draft, { rows: [finished] })
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Prototype' }))

    expect(await screen.findByText('No Prototypes yet')).toBeInTheDocument()
    expect(api.requests).toContainEqual({
      method: 'DELETE',
      path: `/api/projects/${draft.projectId}/prototypes/proto-1`,
      body: {},
    })
  })
})

describe('PrototypesTab New Prototype', () => {
  it('is disabled while a Prototype is being written for the Draft, and says why', async () => {
    prototypeBackend(draft, { rows: [running] })
    renderTab()

    expect(await screen.findByRole('button', { name: 'New Prototype' })).toBeDisabled()
    expect(screen.getByText('A Prototype is already being written for this Draft.')).toBeInTheDocument()
  })

  it('stays available beside Failed and Stopped rows', async () => {
    prototypeBackend(draft, { rows: [failed, stopped] })
    renderTab()
    await screen.findByText('Failed')
    expect(screen.getByRole('button', { name: 'New Prototype' })).toBeEnabled()
  })

  it('opens the start form, and closes it again with Cancel', async () => {
    prototypeBackend(draft)
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'New Prototype' }))
    expect(screen.getByRole('form', { name: 'New Prototype' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'New Prototype' })).not.toBeInTheDocument()
  })

  it('closes the form once the session has started, and shows its row', async () => {
    const api = prototypeBackend(draft)
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'New Prototype' }))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    api.rows = [running]
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText(/Being written/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'New Prototype' })).not.toBeInTheDocument()
  })
})

describe('PrototypesTab empty state', () => {
  it('explains what a Prototype is and how to start one', async () => {
    prototypeBackend(draft)
    renderTab()

    expect(await screen.findByText('No Prototypes yet')).toBeInTheDocument()
    expect(screen.getByText(/clickable mock-up/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Prototype' })).toBeEnabled()
  })

  it('gives way to the start form', async () => {
    prototypeBackend(draft)
    const { user } = renderTab()
    await user.click(await screen.findByRole('button', { name: 'New Prototype' }))
    expect(screen.queryByText('No Prototypes yet')).not.toBeInTheDocument()
  })
})
