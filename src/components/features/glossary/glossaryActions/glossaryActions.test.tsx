// Tests for GlossaryActions: adding a term and editing the markdown, both waiting while something is open.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GlossaryActions } from '@/components/features/glossary/glossaryActions/glossaryActions'
import { render } from '@test/utils/testUtils'

describe('GlossaryActions', () => {
  it('adds a term or opens the markdown', async () => {
    const onAdd = vi.fn()
    const onEditRaw = vi.fn()
    const { user } = render(<GlossaryActions disabled={false} onAdd={onAdd} onEditRaw={onEditRaw} />)
    await user.click(screen.getByRole('button', { name: /Add term/ }))
    await user.click(screen.getByRole('button', { name: 'Edit as markdown' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onEditRaw).toHaveBeenCalledOnce()
  })

  it('waits while an edit is open', () => {
    render(<GlossaryActions disabled onAdd={vi.fn()} onEditRaw={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Add term/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit as markdown' })).toBeDisabled()
  })
})
