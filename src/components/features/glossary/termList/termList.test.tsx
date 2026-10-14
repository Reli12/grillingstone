// Tests for TermList: term lines, the open term's editor in place, the highlight, and an editor that survives
// its term moving.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TermList } from '@/components/features/glossary/termList/termList'
import { render } from '@test/utils/testUtils'

const device = { term: 'Device', definition: 'A metered unit.', avoid: '' }
const site = { term: 'Site', definition: 'Where devices live.', avoid: '' }
const account = { term: 'Account', definition: 'A customer.', avoid: '' }
const editor = <input aria-label="Probe" />

describe('TermList', () => {
  it('lists each term, opening the clicked one with its place in the Glossary', async () => {
    const onEdit = vi.fn()
    const rows = [
      { term: device, index: 0 },
      { term: site, index: 2 },
    ]
    const { user } = render(
      <TermList rows={rows} editingIndex={null} editor={null} highlighted={null} onEdit={onEdit} />,
    )
    await user.click(screen.getByRole('button', { name: /^Site/ }))
    expect(onEdit).toHaveBeenCalledWith({ term: site, index: 2 })
  })

  it('shows the editor in place of the open term', () => {
    const rows = [
      { term: device, index: 0 },
      { term: site, index: 1 },
    ]
    render(<TermList rows={rows} editingIndex={1} editor={editor} highlighted={null} onEdit={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Probe' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Site/ })).not.toBeInTheDocument()
  })

  it('highlights the linked term, ignoring case', () => {
    render(
      <TermList
        rows={[{ term: site, index: 0 }]}
        editingIndex={null}
        editor={null}
        highlighted="site"
        onEdit={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /^Site/ })).toHaveAttribute('data-highlighted', 'true')
  })

  it('keeps the editor and its typed text when a term is added above the open one', async () => {
    const { user, rerender } = render(
      <TermList
        rows={[{ term: device, index: 0 }]}
        editingIndex={0}
        editor={editor}
        highlighted={null}
        onEdit={vi.fn()}
      />,
    )
    await user.type(screen.getByRole('textbox', { name: 'Probe' }), 'typed')
    rerender(
      <TermList
        rows={[
          { term: account, index: 0 },
          { term: device, index: 1 },
        ]}
        editingIndex={1}
        editor={editor}
        highlighted={null}
        onEdit={vi.fn()}
      />,
    )
    expect(screen.getByRole('textbox', { name: 'Probe' })).toHaveValue('typed')
  })
})
