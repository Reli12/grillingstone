// Tests for the Backlog Copies tab: the table, pasting a Copy, the re-paste offer for a work item already copied,
// re-pasting, and deleting after a confirmation that lists the Drafts losing the reference.
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BacklogCopiesPanel } from '@/components/features/backlogCopies/backlogCopiesPanel/backlogCopiesPanel'
import { backlogBackend, backlogCopyFixture } from '@test/mocks/backlogBackend'
import { render } from '@test/utils/testUtils'

const PROJECT = 'fleet'
const referencing = [
  { id: 'd1', title: 'Archive from the device page', requirement: '', workItemType: 'PBI' as const, changed: true },
  { id: 'd2', title: 'Hide archived devices', requirement: '', workItemType: 'PBI' as const, changed: false },
]

describe('BacklogCopiesPanel', () => {
  it('lists each Copy with its type, ID, title, link and the Drafts referencing it, marking those behind', async () => {
    backlogBackend(PROJECT, [{ copy: backlogCopyFixture({ revision: 2 }), drafts: referencing }])
    render(<BacklogCopiesPanel projectId={PROJECT} />)
    const row = (await screen.findByText('Device archiving')).closest('tr')!
    expect(within(row).getByText('#1234')).toBeInTheDocument()
    expect(within(row).getByText('Feature')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: /Open #1234 in Azure DevOps/ })).toHaveAttribute(
      'href',
      backlogCopyFixture().url,
    )
    expect(within(row).getByText(/Archive from the device page/)).toHaveTextContent('changed')
    expect(within(row).getByText('Hide archived devices')).toBeInTheDocument()
  })

  it('pastes a new Copy, Acceptance Criteria included', async () => {
    const backend = backlogBackend(PROJECT)
    const { user } = render(<BacklogCopiesPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: /Paste Backlog Copy/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paste a Backlog Copy' })
    await user.type(within(dialog).getByLabelText(/Work item ID or link/), '#1301')
    await user.type(within(dialog).getByLabelText('Title'), 'Bulk import')
    await user.type(within(dialog).getByLabelText('Description'), 'BR1 — CSV upload.')
    await user.type(within(dialog).getByLabelText(/Acceptance Criteria/), 'AC1 — rows imported.')
    await user.click(within(dialog).getByRole('button', { name: 'Save Backlog Copy' }))
    await waitFor(() =>
      expect(backend.created).toEqual([
        {
          workItem: '#1301',
          workItemType: 'Feature',
          title: 'Bulk import',
          content: 'BR1 — CSV upload.',
          acceptanceCriteria: 'AC1 — rows imported.',
        },
      ]),
    )
    expect(await screen.findByText('Bulk import')).toBeInTheDocument()
  })

  it('offers to re-paste when the work item is already a Copy, and re-pastes it', async () => {
    const backend = backlogBackend(PROJECT, [{ copy: backlogCopyFixture(), drafts: referencing }])
    const { user } = render(<BacklogCopiesPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: /Paste Backlog Copy/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paste a Backlog Copy' })
    await user.type(within(dialog).getByLabelText(/Work item ID or link/), '1234')
    await user.type(within(dialog).getByLabelText('Title'), 'Device archiving')
    await user.type(within(dialog).getByLabelText('Description'), 'BR1 — changed.')
    await user.click(within(dialog).getByRole('button', { name: 'Save Backlog Copy' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Re-paste #1234 instead' }))
    await waitFor(() =>
      expect(backend.repasted).toEqual([
        {
          copyId: 'ado-1234',
          repaste: {
            workItemType: 'Feature',
            title: 'Device archiving',
            content: 'BR1 — changed.',
            acceptanceCriteria: '',
          },
        },
      ]),
    )
  })

  it('re-pastes from the row, starting from the current text', async () => {
    const backend = backlogBackend(PROJECT, [{ copy: backlogCopyFixture(), drafts: referencing }])
    const { user } = render(<BacklogCopiesPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: 'Re-paste #1234' }))
    const dialog = await screen.findByRole('dialog', { name: 'Re-paste #1234' })
    expect(within(dialog).getByText(/2 Drafts reference it/)).toBeInTheDocument()
    const description = within(dialog).getByLabelText('Description')
    expect(description).toHaveValue(backlogCopyFixture().content)
    await user.clear(description)
    await user.type(description, 'BR1 — new.')
    await user.click(within(dialog).getByRole('button', { name: 'Re-paste' }))
    await waitFor(() => expect(backend.repasted[0]?.repaste.content).toBe('BR1 — new.'))
  })

  it('deletes a Copy only after a confirmation listing the Drafts that lose it', async () => {
    const backend = backlogBackend(PROJECT, [{ copy: backlogCopyFixture(), drafts: referencing }])
    const { user } = render(<BacklogCopiesPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: 'Delete #1234' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Backlog Copy #1234?' })
    expect(within(dialog).getByText('Archive from the device page')).toBeInTheDocument()
    expect(within(dialog).getByText('Hide archived devices')).toBeInTheDocument()
    expect(backend.deleted).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Delete Backlog Copy' }))
    await waitFor(() => expect(backend.deleted).toEqual(['ado-1234']))
  })

  it('opens the whole current Copy read-only from its title, and re-pastes from there', async () => {
    const backend = backlogBackend(PROJECT, [{ copy: backlogCopyFixture({ revision: 2 }), drafts: referencing }])
    const { user } = render(<BacklogCopiesPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: 'Device archiving' }))
    const dialog = await screen.findByRole('dialog', { name: 'Feature #1234: Device archiving' })
    expect(within(dialog).getByText(backlogCopyFixture().content)).toBeInTheDocument()
    expect(within(dialog).getByText(backlogCopyFixture().acceptanceCriteria!)).toBeInTheDocument()
    expect(within(dialog).getByText(/Revision 2/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Open in Azure DevOps/ })).toHaveAttribute(
      'href',
      backlogCopyFixture().url,
    )
    expect(within(dialog).getByText(/Archive from the device page/)).toHaveTextContent('changed')
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Re-paste' }))
    const repaste = await screen.findByRole('dialog', { name: 'Re-paste #1234' })
    await user.click(within(repaste).getByRole('button', { name: 'Re-paste' }))
    await waitFor(() => expect(backend.repasted).toHaveLength(1))
  })

  it('invites the first paste when the Project has no Copies', async () => {
    backlogBackend(PROJECT)
    render(<BacklogCopiesPanel projectId={PROJECT} />)
    expect(await screen.findByText(/No Backlog Copies yet/)).toBeInTheDocument()
  })
})
