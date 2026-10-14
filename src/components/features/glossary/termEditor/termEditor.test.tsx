// Tests for TermEditor: saving, cancelling and removing a term, and what it says when a save did not go through.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TermEditor } from '@/components/features/glossary/termEditor/termEditor'
import { render } from '@test/utils/testUtils'

const device = { term: 'Device', definition: 'A metered unit.', avoid: 'asset' }
const ok = { saving: false, stale: false, failure: null }
const handlers = () => ({ onSave: vi.fn(), onCancel: vi.fn(), onRemove: vi.fn() })

describe('TermEditor', () => {
  it('saves the edited fields, cancels and removes', async () => {
    const calls = handlers()
    const { user } = render(<TermEditor initial={device} {...calls} />)
    await user.type(screen.getByRole('textbox', { name: 'Avoid' }), ', meter')
    await user.click(screen.getByRole('button', { name: 'Save term' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: /Remove/ }))
    expect(calls.onSave).toHaveBeenCalledWith({ ...device, avoid: 'asset, meter' }, expect.anything())
    expect(calls.onCancel).toHaveBeenCalledOnce()
    expect(calls.onRemove).toHaveBeenCalledOnce()
  })

  it('offers no Remove for a term not saved yet', () => {
    render(<TermEditor initial={device} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('cannot be saved again while a save is in flight', () => {
    render(<TermEditor initial={device} {...handlers()} status={{ ...ok, saving: true }} />)
    expect(screen.getByRole('button', { name: 'Save term' })).toBeDisabled()
  })

  it('says when the Glossary changed meanwhile, or why the save failed', () => {
    const { rerender } = render(<TermEditor initial={device} {...handlers()} status={{ ...ok, stale: true }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Save again to apply your change to the latest version.')
    rerender(<TermEditor initial={device} {...handlers()} status={{ ...ok, failure: 'Disk full' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save: Disk full")
  })
})
