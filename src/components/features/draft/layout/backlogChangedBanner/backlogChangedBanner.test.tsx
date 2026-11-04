// Tests for the banner a Draft shows when a Backlog Copy it references was re-pasted since its last session.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { v1Draft } from '#core/testing/fixtures.ts'

import { BacklogChangedBanner } from '@/components/features/draft/layout/backlogChangedBanner/backlogChangedBanner'
import { backlogBackend, backlogCopyFixture } from '@test/mocks/backlogBackend'
import { render } from '@test/utils/testUtils'

const draftSeeing = (seenRevision: number) => ({
  ...v1Draft(),
  backlogReferences: [{ copyId: 'ado-1234', seenRevision }],
})

describe('BacklogChangedBanner', () => {
  it('names each Copy re-pasted since the Draft last saw it', async () => {
    backlogBackend(v1Draft().projectId, [{ copy: backlogCopyFixture({ revision: 2 }), drafts: [] }])
    render(<BacklogChangedBanner draft={draftSeeing(1)} />)
    expect(
      await screen.findByText(/Backlog Copy #1234 Device archiving changed since this Draft's last session/),
    ).toBeInTheDocument()
  })

  it('shows nothing when the Draft is up to date or has no Backlog References', async () => {
    backlogBackend(v1Draft().projectId, [{ copy: backlogCopyFixture({ revision: 2 }), drafts: [] }])
    const { unmount } = render(<BacklogChangedBanner draft={draftSeeing(2)} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText(/changed since this Draft's last session/)).not.toBeInTheDocument()
    unmount()
    render(<BacklogChangedBanner draft={v1Draft()} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText(/changed since this Draft's last session/)).not.toBeInTheDocument()
  })
})
