// Tests for ProjectDrafts: the board of Lanes opening on the last week, the sidebar filters, Archived Drafts and
// restoring them, and the first-Draft prompt. Dragging itself is dnd-kit's; the board is tested through its result.
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { ProjectDrafts } from '@/components/features/projects/projectDrafts/projectDrafts'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const draft = (id: string, patch: Partial<DraftSummary> = {}): DraftSummary => ({
  id,
  projectId: 'portal',
  title: `Draft ${id}`,
  requirement: '',
  workItemType: 'PBI',
  version: 1,
  templateName: 'Default PBI Template',
  pendingChanges: 0,
  changedBacklogCopies: [],
  lane: 'review',
  archived: false,
  updatedAt: daysAgo(1),
  ...patch,
})

const drafts = [
  draft('grilled', { lane: 'grilling', version: 0, title: '', requirement: 'Grill me on exports' }),
  draft('triage', { lane: 'needs', pendingChanges: 2, changedBacklogCopies: [1234] }),
  draft('bug', { lane: 'ready', workItemType: 'Bug', templateName: 'Default Bug Template' }),
  draft('old', { updatedAt: daysAgo(20) }),
  draft('done', { archived: true, lane: 'ready' }),
]

const lane = (name: string) => screen.getByRole('region', { name })

describe('ProjectDrafts', () => {
  it('shows each open Draft in its Lane, opening on the last 7 days', () => {
    render(<ProjectDrafts projectId="portal" drafts={drafts} />)
    expect(within(lane('Grilling')).getByText('Grill me on exports')).toBeInTheDocument()
    expect(within(lane('Needs you')).getByText('2 changes to triage · Backlog Copy #1234 changed')).toBeInTheDocument()
    expect(within(lane('Ready to publish')).getByRole('link', { name: 'Draft bug' })).toBeInTheDocument()
    // The old Draft is in In review but outside the default window; the Archived one is off the board.
    expect(within(lane('In review')).getByText('0 of 1')).toBeInTheDocument()
    expect(screen.queryByText('Draft done')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Last 7 days/ })).toBeChecked()
  })

  it('filters the board, and Reset goes back to the last-week default', async () => {
    const { user } = render(<ProjectDrafts projectId="portal" drafts={drafts} />)
    await user.click(screen.getByRole('radio', { name: 'Any time' }))
    expect(within(lane('In review')).getByRole('link', { name: 'Draft old' })).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /^Bug/ }))
    expect(screen.queryByRole('link', { name: 'Draft old' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Draft bug' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(screen.getByRole('radio', { name: /Last 7 days/ })).toBeChecked()
    expect(screen.queryByRole('link', { name: 'Draft old' })).not.toBeInTheDocument()
  })

  it('collapses a Lane to a strip that still counts its Drafts', async () => {
    const { user } = render(<ProjectDrafts projectId="portal" drafts={drafts} />)
    await user.click(screen.getByRole('button', { name: 'Collapse Needs you' }))
    expect(screen.getByTitle('Expand Needs you')).toHaveTextContent('Needs you · 1')
  })

  it('lists the Archived Drafts and restores one', async () => {
    let sent: unknown
    server.use(
      http.patch(`*${endpoints.draftArchived('portal', 'done')}`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({})
      }),
      http.get(`*${endpoints.drafts('portal')}`, () => HttpResponse.json(drafts)),
    )
    const { user } = render(<ProjectDrafts projectId="portal" drafts={drafts} />)
    await user.click(screen.getByRole('tab', { name: 'Archived 1' }))
    expect(screen.getByRole('link', { name: 'Draft done' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await vi.waitFor(() => expect(sent).toEqual({ archived: false }))
  })

  it('prompts for a first Draft when there is none', () => {
    render(<ProjectDrafts projectId="portal" drafts={[]} />)
    expect(screen.getByText('No Drafts in this Project yet')).toBeInTheDocument()
  })
})
