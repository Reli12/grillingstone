// Tests for AddEntryForm: it needs a title and text, trims them, and can be cancelled.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddEntryForm } from '@/components/features/draft/addEntryForm/addEntryForm'

describe('AddEntryForm', () => {
  it('needs a title and text, and trims them', async () => {
    const onSave = vi.fn()
    render(<AddEntryForm onSave={onSave} onCancel={() => {}} />)
    const add = screen.getByRole('button', { name: 'Add' })
    await userEvent.type(screen.getByRole('textbox', { name: 'Entry title' }), ' AC03 ')
    expect(add).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Entry text' }), 'Given… ')
    await userEvent.click(add)
    expect(onSave).toHaveBeenCalledWith('AC03', 'Given…')
  })

  it('cancels', async () => {
    const onCancel = vi.fn()
    render(<AddEntryForm onSave={() => {}} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
