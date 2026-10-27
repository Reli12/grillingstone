// Tests for the Project page's Prototypes tab: every row of every Draft with its Draft title, the Draft chooser that
// offers only Drafts at v1 or later before the shared start form, Try again, Delete in step with the Draft's own
// list, and the empty states.
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { PrototypeRow } from '#core/prototype/prototypeRecords.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { ProjectPrototypesTab } from '@/components/features/prototypes/projectPrototypesTab/projectPrototypesTab'
import { PrototypesTab } from '@/components/features/prototypes/prototypesTab/prototypesTab'
import { finishedRow, prototypeBackend, sessionOf } from '@test/mocks/prototypeBackend'
import { render } from '@test/utils/testUtils'

const archive = v1Draft()
const exportDraft: Draft = { ...archive, id: 'd-export', title: 'Export report', version: 1 }
const summaryOf = (draft: Draft, version = draft.version): DraftSummary => ({
  id: draft.id,
  projectId: draft.projectId,
  title: draft.title,
  requirement: draft.requirement,
  workItemType: draft.workItemType,
  version,
  templateName: 'PBI',
  pendingChanges: 0,
  updatedAt: '2026-10-25T10:00:00Z',
})
const brandNew = summaryOf({ ...archive, id: 'd-new', title: 'Brand new Draft' }, 0)
const drafts = [summaryOf(archive, 2), summaryOf(exportDraft), brandNew]

const archiveName = new RegExp(archive.title)

const renderTab = () => render(<ProjectPrototypesTab projectId={archive.projectId} drafts={drafts} />)

const stoppedOfExport: PrototypeRow = {
  kind: 'stopped',
  session: sessionOf(exportDraft, { id: 'psess-3', status: 'stopped', draftVersion: 1 }),
}
const failedOfExport: PrototypeRow = {
  kind: 'failed',
  session: sessionOf(exportDraft, { id: 'psess-2', status: 'failed', draftVersion: 1, error: 'It broke' }),
  messages: [],
}
const runningOfArchive: PrototypeRow = {
  kind: 'running',
  session: sessionOf(archive, { id: 'psess-1', draftVersion: 2 }),
}
const finishedOfArchive = finishedRow(archive, { id: 'proto-1', draftVersion: 2 })

describe('ProjectPrototypesTab rows', () => {
  it('lists every row of every Draft in the order given, each with its Draft title, version and time', async () => {
    prototypeBackend(archive, { rows: [runningOfArchive, stoppedOfExport, finishedOfArchive] })
    renderTab()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText(archive.title)).toBeInTheDocument()
    expect(within(items[0]).getByText(/Being written for Draft v2/)).toBeInTheDocument()
    expect(within(items[1]).getByText('Export report')).toBeInTheDocument()
    expect(within(items[1]).getByText('Stopped')).toBeInTheDocument()
    expect(within(items[2]).getByText(archive.title)).toBeInTheDocument()
    expect(within(items[2]).getByRole('link', { name: /^v2 · / })).toBeInTheDocument()
  })

  it('shows a Failed row of a Draft with its reason', async () => {
    prototypeBackend(archive, { rows: [failedOfExport] })
    renderTab()
    expect(await screen.findByText('It broke')).toBeInTheDocument()
    expect(screen.getByText('Export report')).toBeInTheDocument()
  })

  it('names the Prototype a finished one started from', async () => {
    const later = finishedRow(archive, { id: 'proto-2', draftVersion: 3, startingPrototypeId: 'proto-1' })
    prototypeBackend(archive, { rows: [later, finishedOfArchive] })
    renderTab()
    expect(await screen.findByText(/^started from v2 · /)).toBeInTheDocument()
  })
})

describe('ProjectPrototypesTab empty state', () => {
  it('explains what a Prototype is and how to start one', async () => {
    prototypeBackend(archive)
    renderTab()

    expect(await screen.findByText('No Prototypes yet')).toBeInTheDocument()
    expect(screen.getByText(/interactive illustration of what a Draft describes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New Prototype' })).toBeEnabled()
  })
})

describe('ProjectPrototypesTab + New Prototype', () => {
  const openChooser = async (user: ReturnType<typeof renderTab>['user']) => {
    await user.click(await screen.findByRole('button', { name: '+ New Prototype' }))
    const form = await screen.findByRole('form', { name: 'New Prototype' })
    return within(form).findByRole('combobox', { name: 'Draft (optional)' })
  }

  it('opens the form with a Draft chooser that offers only Drafts at v1 or later, none chosen', async () => {
    prototypeBackend(archive, { drafts })
    const { user } = renderTab()

    const chooser = await openChooser(user)
    expect(chooser).toHaveValue('')
    expect(within(chooser).getByRole('option', { name: 'No Draft' })).toBeInTheDocument()
    expect(within(chooser).getByRole('option', { name: archiveName })).toBeInTheDocument()
    expect(within(chooser).getByRole('option', { name: /Export report/ })).toBeInTheDocument()
    expect(within(chooser).queryByRole('option', { name: /Brand new Draft/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Write now' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start grilling' })).toBeEnabled()
  })

  it('says so when no Draft has reached v1', async () => {
    prototypeBackend(archive, { drafts: [brandNew] })
    const { user } = render(<ProjectPrototypesTab projectId={archive.projectId} drafts={[brandNew]} />)

    await openChooser(user)
    expect(screen.getByText(/No Draft has reached v1 yet/)).toBeInTheDocument()
  })

  it('does not offer a Draft that has a Prototype being written', async () => {
    prototypeBackend(archive, { rows: [runningOfArchive], drafts })
    const { user } = renderTab()

    const chooser = await openChooser(user)
    await vi.waitFor(() => expect(within(chooser).getByRole('option', { name: archiveName })).toBeDisabled())
    expect(within(chooser).getByRole('option', { name: /Export report/ })).toBeEnabled()
  })

  it('writes now on the chosen Draft with the single-turn session', async () => {
    const api = prototypeBackend(exportDraft, { drafts })
    const { user } = renderTab()

    const chooser = await openChooser(user)
    await user.selectOptions(chooser, exportDraft.id)
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Write now' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Write now' }))

    await vi.waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'POST',
        path: `/api/projects/${exportDraft.projectId}/drafts/${exportDraft.id}/prototype-sessions`,
        body: { tickedImages: [] },
      }),
    )
  })

  it('closes the form with Cancel', async () => {
    prototypeBackend(archive, { drafts })
    const { user } = renderTab()

    await openChooser(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'New Prototype' })).not.toBeInTheDocument()
  })
})

describe('ProjectPrototypesTab row actions', () => {
  it('Try again opens the start form of that row’s Draft, refilled', async () => {
    const inputs = { 'psess-2': { tickedImages: [], extraImages: [], startingPrototypeId: 'proto-9' } }
    prototypeBackend(exportDraft, { rows: [failedOfExport, finishedRow(exportDraft, { id: 'proto-9' })], inputs })
    const { user } = renderTab()

    const [failedItem] = await screen.findAllByRole('listitem')
    await user.click(within(failedItem).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('form', { name: 'New Prototype' })).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: /earlier Prototype/ })).toHaveValue('proto-9')
  })

  it('Dismiss removes a Failed row', async () => {
    prototypeBackend(archive, { rows: [failedOfExport] })
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(await screen.findByText('No Prototypes yet')).toBeInTheDocument()
  })

  it('Delete asks first, and Cancel keeps the Prototype', async () => {
    prototypeBackend(archive, { rows: [finishedOfArchive] })
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('link', { name: /^v2 · / })).toBeInTheDocument()
  })

  it('a Prototype deleted here is gone from the Draft’s own list too', async () => {
    prototypeBackend(archive, { rows: [finishedOfArchive] })
    const { user } = render(
      <>
        <PrototypesTab projectId={archive.projectId} draftId={archive.id} />
        <ProjectPrototypesTab projectId={archive.projectId} drafts={drafts} />
      </>,
    )

    await vi.waitFor(() => expect(screen.getAllByRole('link', { name: /^v2 · / })).toHaveLength(2))
    // The Draft's tab comes first in the page, the Project's second.
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Prototype' }))

    await vi.waitFor(() => expect(screen.queryAllByRole('link', { name: /^v2 · / })).toHaveLength(0))
    expect(screen.getAllByText('No Prototypes yet')).toHaveLength(2)
  })
})
