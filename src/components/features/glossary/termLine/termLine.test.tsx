// Tests for TermLine: one term on one line, its full definition on hover, its anchor and highlight.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { termAnchor } from '#core/glossary/glossary.ts'

import { TermLine } from '@/components/features/glossary/termLine/termLine'
import { render } from '@test/utils/testUtils'

const device = { term: 'Device', definition: 'A metered unit.', avoid: 'asset' }

describe('TermLine', () => {
  it('shows the term, its definition and the words to avoid, and opens its editor on click', async () => {
    const onEdit = vi.fn()
    const { user } = render(<TermLine term={device} onEdit={onEdit} />)
    const line = screen.getByRole('button', { name: /^Device/ })
    expect(line).toHaveTextContent('DeviceA metered unit.Avoid: asset')
    expect(line).toHaveAttribute('title', 'A metered unit.')
    expect(line).toHaveAttribute('id', termAnchor('Device'))
    await user.click(line)
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('leaves out the words to avoid when there are none', () => {
    render(<TermLine term={{ ...device, avoid: '' }} onEdit={vi.fn()} />)
    expect(screen.queryByText(/Avoid/)).not.toBeInTheDocument()
  })

  it('marks itself when highlighted', () => {
    const { rerender } = render(<TermLine term={device} onEdit={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('data-highlighted', 'false')
    rerender(<TermLine term={device} highlighted onEdit={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('data-highlighted', 'true')
  })
})
