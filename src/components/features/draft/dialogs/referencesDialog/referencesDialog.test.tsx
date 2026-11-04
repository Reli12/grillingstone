// Tests for the References dialog's Backlog References: shown apart from Draft References, toggled on the Draft,
// and absent in a Jira Project.
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Draft } from '#core/draft/draftTypes.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { ReferencesDialog } from '@/components/features/draft/dialogs/referencesDialog/referencesDialog'
import { backlogBackend, backlogCopyFixture } from '@test/mocks/backlogBackend'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

function backend(tracker: 'azure-devops' | 'jira', draft: Draft) {
  const patches: unknown[] = []
  server.use(
    http.get(`*${endpoints.project(draft.projectId)}`, () =>
      HttpResponse.json({ id: draft.projectId, name: 'P', createdAt: '', tracker }),
    ),
    http.get(`*${endpoints.drafts(draft.projectId)}`, () => HttpResponse.json([])),
    http.patch(`*${endpoints.draftBacklogReferences(draft.projectId, draft.id)}`, async ({ request }) => {
      patches.push(await request.json())
      return HttpResponse.json(draft)
    }),
  )
  backlogBackend(draft.projectId, [
    { copy: backlogCopyFixture(), drafts: [] },
    {
      copy: backlogCopyFixture({ id: 'ado-1422', workItemId: 1422, workItemType: 'Bug', title: 'Search bug' }),
      drafts: [],
    },
  ])
  return patches
}

describe('ReferencesDialog — Backlog References', () => {
  it('lists the Backlog Copies apart from the Draft References and toggles them on the Draft', async () => {
    const draft = { ...v1Draft(), backlogReferences: [{ copyId: 'ado-1234', seenRevision: 1 }] }
    const patches = backend('azure-devops', draft)
    const { user } = render(<ReferencesDialog open onClose={() => undefined} draft={draft} />)
    expect(await screen.findByRole('heading', { name: 'Backlog References' })).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: /#1234 Device archiving/ })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /#1422 Search bug/ }))
    await waitFor(() => expect(patches).toEqual([{ backlogReferences: ['ado-1234', 'ado-1422'] }]))
  })

  it('has no Backlog References in a Jira Project', async () => {
    backend('jira', v1Draft())
    render(<ReferencesDialog open onClose={() => undefined} draft={v1Draft()} />)
    expect(await screen.findByText(/No other written Drafts/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Backlog References' })).not.toBeInTheDocument()
  })
})
