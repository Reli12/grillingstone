// Tests for ProjectDrafts: the Drafts (or a first-Draft prompt) beside the read-only Glossary preview.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import { addTerm } from '#core/glossary/glossary.ts'

import { ProjectDrafts } from '@/components/features/projects/projectDrafts/projectDrafts'
import { glossaryBackend } from '@test/mocks/glossaryBackend'
import { render } from '@test/utils/testUtils'

const draft: DraftSummary = {
  id: 'd1',
  projectId: 'portal',
  title: 'Archive devices',
  requirement: 'Managers archive devices.',
  workItemType: 'PBI',
  version: 1,
  templateName: 'Default PBI Template',
  pendingChanges: 0,
  updatedAt: '2026-10-14T10:00:00.000Z',
}

describe('ProjectDrafts', () => {
  it('lists the Drafts beside the Glossary preview', async () => {
    glossaryBackend('portal', addTerm('', { term: 'Device', definition: 'A unit.', avoid: '' }, 'Portal'))
    render(<ProjectDrafts projectId="portal" projectName="Portal" drafts={[draft]} />)
    expect(screen.getByText('Archive devices')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Glossary' })).toBeInTheDocument()
    expect(
      screen.getByText('Shared by every Draft in Portal. Every session is challenged against it.'),
    ).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Device' })).toBeInTheDocument()
  })

  it('prompts for a first Draft when there is none', () => {
    glossaryBackend('portal', '')
    render(<ProjectDrafts projectId="portal" projectName="Portal" drafts={[]} />)
    expect(screen.getByText('No Drafts in this Project yet')).toBeInTheDocument()
  })
})
