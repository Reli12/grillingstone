// Tests for the Prototype viewer page: the bar with the Draft title, version and time, the number of assumptions and
// Download, over a sandboxed full-height frame that loads the view route.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { v1Draft } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import PrototypeViewerPage from '@/pages/PrototypeViewerPage/PrototypeViewerPage'
import { finishedRow, prototypeBackend } from '@test/mocks/prototypeBackend'
import { render } from '@test/utils/testUtils'

const draft = v1Draft()
const renderViewer = (prototypeId = 'proto-1') =>
  render(<PrototypeViewerPage />, {
    route: `/p/${draft.projectId}/prototypes/${prototypeId}`,
    path: '/p/:projectId/prototypes/:prototypeId',
  })

describe('PrototypeViewerPage', () => {
  it('shows the Draft title, the version and time, the number of assumptions and Download', async () => {
    prototypeBackend(draft, { rows: [finishedRow(draft, { draftVersion: 2 })], draftTitle: 'Archive devices' })
    renderViewer()

    expect(await screen.findByRole('heading', { name: 'Archive devices' })).toBeInTheDocument()
    expect(screen.getByText(/^v2 · /)).toBeInTheDocument()
    expect(screen.getByText('1 assumption')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      endpoints.prototypeDownload(draft.projectId, 'proto-1'),
    )
  })

  it('counts several assumptions', async () => {
    const assumptions = [
      { choice: 'Ten rows', why: 'No page size.' },
      { choice: 'Blue buttons', why: 'No brand colour.' },
    ]
    prototypeBackend(draft, { rows: [finishedRow(draft, { assumptions })] })
    renderViewer()
    expect(await screen.findByText('2 assumptions')).toBeInTheDocument()
  })

  it('loads the view route in a sandboxed frame that allows scripts, forms and dialogs only', async () => {
    prototypeBackend(draft, { rows: [finishedRow(draft)] })
    renderViewer()

    const frame = await screen.findByTitle('Prototype')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', endpoints.prototypeView(draft.projectId, 'proto-1'))
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-forms allow-modals')
  })

  it('says so when the Prototype is not found', async () => {
    prototypeBackend(draft)
    renderViewer('proto-gone')
    expect(await screen.findByText('No such Prototype')).toBeInTheDocument()
    expect(screen.queryByTitle('Prototype')).not.toBeInTheDocument()
  })
})
