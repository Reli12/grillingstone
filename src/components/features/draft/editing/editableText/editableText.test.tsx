// Tests for EditableText: editing prose and Entry titles in place, skipping unchanged or blank saves, cancelling.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EditableText } from '@/components/features/draft/editing/editableText/editableText'

describe('EditableText', () => {
  it('edits prose in place and saves a change', async () => {
    const onSave = vi.fn()
    render(
      <EditableText value="Old text" onSave={onSave}>
        Old text
      </EditableText>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Old text' }))
    const box = screen.getByRole('textbox', { name: 'Text' })
    await userEvent.clear(box)
    await userEvent.type(box, 'New text')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ body: 'New text' })
    expect(screen.getByRole('button', { name: 'Old text' })).toBeInTheDocument()
  })

  it('edits an Entry title too, saving with Cmd+Enter', async () => {
    const onSave = vi.fn()
    render(
      <EditableText value="Body" title="AC01" onSave={onSave}>
        AC01
      </EditableText>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'AC01' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Entry title' }), ' edited{Meta>}{Enter}{/Meta}')
    expect(onSave).toHaveBeenCalledWith({ body: 'Body', title: 'AC01 edited' })
  })

  it('does not save unchanged or blank text', async () => {
    const onSave = vi.fn()
    render(
      <EditableText value="Body" title="AC01" onSave={onSave}>
        AC01
      </EditableText>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'AC01' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await userEvent.click(screen.getByRole('button', { name: 'AC01' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Entry title' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('cancels with Escape and stays read-only when disabled', async () => {
    const onSave = vi.fn()
    const { rerender } = render(
      <EditableText value="Body" onSave={onSave}>
        Body
      </EditableText>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Body' }))
    await userEvent.type(screen.getByRole('textbox'), ' more{Escape}')
    expect(onSave).not.toHaveBeenCalled()

    rerender(
      <EditableText value="Body" onSave={onSave} disabled>
        Body
      </EditableText>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Body' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
