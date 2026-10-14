// Tests for GlossaryFilter: typing narrows the list, and the box can be switched off.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GlossaryFilter } from '@/components/features/glossary/glossaryFilter/glossaryFilter'
import { render } from '@test/utils/testUtils'

describe('GlossaryFilter', () => {
  it('reports what is typed', async () => {
    const onChange = vi.fn()
    const { user } = render(<GlossaryFilter value="" onChange={onChange} disabled={false} />)
    await user.type(screen.getByRole('searchbox', { name: 'Filter terms' }), 'd')
    expect(onChange).toHaveBeenCalledWith('d')
  })

  it('shows its value and can be disabled', () => {
    render(<GlossaryFilter value="site" onChange={vi.fn()} disabled />)
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toHaveValue('site')
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toBeDisabled()
  })
})
