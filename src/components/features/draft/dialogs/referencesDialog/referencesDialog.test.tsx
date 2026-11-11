// Tests for the References dialog: tabs per kind, filters (text, Archived Drafts), staged changes marked on their
// rows, Save writing them (Backlog References before the Parent), Discard asking first, and no Backlog Copies in a
// Jira Project.
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { ReferencesDialog } from '@/components/features/draft/dialogs/referencesDialog/referencesDialog'
import { backlogBackend, backlogCopyFixture } from '@test/mocks/backlogBackend'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const summary = (id: string, title: string, archived = false): DraftSummary => ({
  id,
  projectId: 'customer-portal',
  title,
  requirement: '',
  workItemType: 'PBI',
  version: 1,
  templateName: 'Default PBI',
  pendingChanges: 0,
  changedBacklogCopies: [],
  lane: 'review',
  archived,
  updatedAt: '2026-11-01',
})

function backend(tracker: 'azure-devops' | 'jira', draft: Draft) {
  const sent: { path: string; body: unknown }[] = []
  const record =
    (path: string) =>
    async ({ request }: { request: Request }) => {
      sent.push({ path, body: await request.json() })
      return HttpResponse.json(draft)
    }
  server.use(
    http.get(`*${endpoints.project(draft.projectId)}`, () =>
      HttpResponse.json({ id: draft.projectId, name: 'P', createdAt: '', tracker }),
    ),
    http.get(`*${endpoints.drafts(draft.projectId)}`, () =>
      HttpResponse.json([
        summary('d-2', 'Device list filters'),
        summary('d-3', 'Old export flow', true),
        summary('d-4', 'Archive confirmation'),
      ]),
    ),
    http.patch(`*${endpoints.draftReferences(draft.projectId, draft.id)}`, record('references')),
    http.patch(`*${endpoints.draftBacklogReferences(draft.projectId, draft.id)}`, record('backlogReferences')),
    http.patch(`*${endpoints.draftParent(draft.projectId, draft.id)}`, record('parent')),
  )
  backlogBackend(draft.projectId, [
    { copy: backlogCopyFixture(), drafts: [] },
    {
      copy: backlogCopyFixture({ id: 'ado-1422', workItemId: 1422, workItemType: 'Bug', title: 'Search bug' }),
      drafts: [],
    },
  ])
  return sent
}

describe('ReferencesDialog', () => {
  it('stages a ticked Draft, marks it, and writes nothing until Save', async () => {
    const draft = v1Draft()
    const sent = backend('azure-devops', draft)
    const { user } = render(<ReferencesDialog open onClose={() => undefined} draft={draft} />)
    await user.click(await screen.findByRole('checkbox', { name: 'Device list filters' }))
    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(sent).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(sent).toEqual([{ path: 'references', body: { references: ['d-2'] } }]))
  })

  it('hides Archived Drafts until asked for, and filters by text', async () => {
    const draft = v1Draft()
    backend('azure-devops', draft)
    const { user } = render(<ReferencesDialog open onClose={() => undefined} draft={draft} />)
    expect(await screen.findByRole('checkbox', { name: 'Device list filters' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Old export flow' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.getByRole('checkbox', { name: 'Old export flow' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Device list filters' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Active' }))
    await user.type(screen.getByRole('textbox', { name: 'Filter References' }), 'export')
    expect(screen.getByText(/No Active Drafts match. 1 Archived one is hidden/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All' }))
    await user.clear(screen.getByRole('textbox', { name: 'Filter References' }))
    await user.type(screen.getByRole('textbox', { name: 'Filter References' }), 'archive')
    expect(screen.getByRole('checkbox', { name: 'Archive confirmation' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Old export flow' })).not.toBeInTheDocument()
  })

  it('makes an unticked Backlog Copy the Parent, saving the Backlog References before the Parent', async () => {
    const draft = { ...v1Draft(), backlogReferences: [{ copyId: 'ado-1234', seenRevision: 1 }] }
    const sent = backend('azure-devops', draft)
    const { user } = render(<ReferencesDialog open onClose={() => undefined} draft={draft} />)
    await user.click(await screen.findByRole('tab', { name: /Backlog Copies/ }))
    expect(await screen.findByRole('checkbox', { name: '#1234 Device archiving' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Parent: #1422 Search bug' }))
    expect(screen.getByRole('checkbox', { name: '#1422 Search bug' })).toBeChecked()
    expect(screen.getByText('2 unsaved changes').closest('p')).toHaveTextContent('1 added · Parent → #1422 Search bug')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(sent).toEqual([
        { path: 'backlogReferences', body: { backlogReferences: ['ado-1234', 'ado-1422'] } },
        { path: 'parent', body: { copyId: 'ado-1422' } },
      ]),
    )
  })

  it('asks before discarding, then drops every change', async () => {
    const draft = v1Draft()
    const sent = backend('azure-devops', draft)
    const { user } = render(<ReferencesDialog open onClose={() => undefined} draft={draft} />)
    const row = await screen.findByRole('checkbox', { name: 'Device list filters' })
    await user.click(row)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByText('Discard them?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(row).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    const bar = screen.getByText('Discard them?').parentElement!
    await user.click(within(bar).getByRole('button', { name: 'Discard' }))
    expect(row).not.toBeChecked()
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument()
    expect(sent).toEqual([])
  })

  it('has no Backlog Copies in a Jira Project', async () => {
    backend('jira', v1Draft())
    render(<ReferencesDialog open onClose={() => undefined} draft={v1Draft()} />)
    expect(await screen.findByRole('tab', { name: /Drafts/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Backlog Copies/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Parent' })).not.toBeInTheDocument()
  })
})
