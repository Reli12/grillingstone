// Tests for the list of Prototype rows: on the Project's tab each row names its Draft, on a Draft's own tab it does not.
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PrototypeRow } from '#core/prototype/prototypeRecords.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { PrototypeList } from '@/components/features/prototypes/prototypeList/prototypeList'
import { finishedRow, sessionOf } from '@test/mocks/prototypeBackend'
import { render } from '@test/utils/testUtils'

const draft = v1Draft()
const rows: PrototypeRow[] = [
  { kind: 'running', session: sessionOf(draft) },
  finishedRow({ ...draft, id: 'draft-gone' }, { id: 'proto-9' }),
]

describe('PrototypeList', () => {
  it('names the Draft of each row when it is given the Draft titles, and says so for a deleted Draft', () => {
    render(<PrototypeList rows={rows} draftTitles={new Map([[draft.id, 'Checkout flow']])} onTryAgain={vi.fn()} />)

    const [first, second] = screen.getAllByRole('listitem')
    expect(within(first).getByText('Checkout flow')).toBeInTheDocument()
    expect(within(second).getByText('A deleted Draft')).toBeInTheDocument()
  })

  it('does not name a Draft when it is not given the titles', () => {
    render(<PrototypeList rows={rows} onTryAgain={vi.fn()} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('A deleted Draft')).not.toBeInTheDocument()
    expect(screen.queryByText('Checkout flow')).not.toBeInTheDocument()
  })
})
