// Tests for RawEditor: editing the whole CONTEXT.md, and keeping or discarding it after a refused save.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RawEditor } from '@/components/features/glossary/rawEditor/rawEditor'
import { render } from '@test/utils/testUtils'

const ok = { saving: false, stale: false, failure: null }
const handlers = () => ({ onChange: vi.fn(), onSave: vi.fn(), onCancel: vi.fn() })

describe('RawEditor', () => {
  it('edits, saves and cancels the whole markdown', async () => {
    const calls = handlers()
    const { user } = render(<RawEditor markdown="# Portal" {...calls} />)
    await user.type(screen.getByRole('textbox', { name: 'CONTEXT.md' }), '!')
    await user.click(screen.getByRole('button', { name: 'Save CONTEXT.md' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.onChange).toHaveBeenCalledWith('# Portal!')
    expect(calls.onSave).toHaveBeenCalledOnce()
    expect(calls.onCancel).toHaveBeenCalledOnce()
  })

  it('offers to save mine anyway or discard it once the Glossary changed meanwhile', () => {
    render(<RawEditor markdown="mine" {...handlers()} status={{ ...ok, stale: true }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The Glossary changed while you were editing.')
    expect(screen.getByRole('button', { name: 'Save mine anyway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard and reload' })).toBeInTheDocument()
  })

  it('says why a save failed, and cannot be saved again while a save is in flight', () => {
    render(<RawEditor markdown="mine" {...handlers()} status={{ saving: true, stale: false, failure: 'Disk full' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save: Disk full")
    expect(screen.getByRole('button', { name: 'Save CONTEXT.md' })).toBeDisabled()
  })
})
