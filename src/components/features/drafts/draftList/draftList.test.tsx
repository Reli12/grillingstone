import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { DraftList } from '@/components/features/drafts/draftList/draftList'
import { render } from '@test/utils/testUtils'

const draft = (id: string, patch: Partial<DraftSummary>): DraftSummary => ({
  id,
  projectId: 'p',
  title: `Draft ${id}`,
  requirement: '',
  workItemType: 'PBI',
  version: 1,
  templateName: 'Default PBI Template',
  pendingChanges: 0,
  updatedAt: '2026-09-23T09:00:00Z',
  ...patch,
})

describe('DraftList', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-09-23T12:00:00Z'), toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('shows type, version, pending Changes and how long ago', () => {
    render(
      <DraftList
        drafts={[
          draft('a', {}),
          draft('b', { workItemType: 'Feature', updatedAt: '2026-09-22T09:00:00Z', pendingChanges: 3 }),
          draft('c', {
            workItemType: 'Epic',
            updatedAt: '2026-09-20T09:00:00Z',
            version: 0,
            title: '',
            requirement: 'Archive everything',
          }),
          draft('d', { updatedAt: '2026-08-01T09:00:00Z' }),
        ]}
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByText('1 day ago')).toBeInTheDocument()
    expect(screen.getByText('3 days ago')).toBeInTheDocument()
    expect(screen.getByText('3 changes to triage')).toBeInTheDocument()
    expect(screen.getByText('Archive everything')).toBeInTheDocument()
    expect(screen.getByText(/Grilling — no Draft yet/)).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-08-01T09:00:00Z').toLocaleDateString())).toBeInTheDocument()
  })
})
