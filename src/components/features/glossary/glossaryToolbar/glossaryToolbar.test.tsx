// Tests for GlossaryToolbar: the term count, and what waits while a term or the markdown is open.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GlossaryToolbar } from '@/components/features/glossary/glossaryToolbar/glossaryToolbar'
import { render } from '@test/utils/testUtils'

const props = {
  query: '',
  onQueryChange: vi.fn(),
  shown: 3,
  total: 3,
  rawOpen: false,
  termOpen: false,
  onAdd: vi.fn(),
  onEditRaw: vi.fn(),
}

describe('GlossaryToolbar', () => {
  it('counts the terms, or the matches while filtering', () => {
    const { rerender } = render(<GlossaryToolbar {...props} />)
    expect(screen.getByText('3 terms')).toBeInTheDocument()
    rerender(<GlossaryToolbar {...props} total={1} shown={1} />)
    expect(screen.getByText('1 term')).toBeInTheDocument()
    rerender(<GlossaryToolbar {...props} query="dev" shown={1} />)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('switches the filter and actions off while the markdown is open, counting all terms', () => {
    render(<GlossaryToolbar {...props} query="dev" shown={1} rawOpen />)
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Add term/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit as markdown' })).toBeDisabled()
    expect(screen.getByText('3 terms')).toBeInTheDocument()
  })

  it('keeps the filter on but the actions off while a term is open', () => {
    render(<GlossaryToolbar {...props} termOpen />)
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Add term/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit as markdown' })).toBeDisabled()
  })
})
