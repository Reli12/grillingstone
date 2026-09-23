import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextArea } from '@/components/atoms/textArea/textArea'

describe('TextArea', () => {
  it('forwards its ref and passes input through', async () => {
    const ref = createRef<HTMLTextAreaElement>()
    const onInput = vi.fn()
    render(<TextArea ref={ref} aria-label="Note" onInput={onInput} minRows={4} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'hi')
    expect(ref.current).toBe(screen.getByRole('textbox'))
    expect(ref.current?.rows).toBe(4)
    expect(onInput).toHaveBeenCalled()
  })

  it('works controlled', () => {
    render(<TextArea value="fixed" onChange={() => {}} aria-label="Note" />)
    expect(screen.getByRole('textbox')).toHaveValue('fixed')
  })
})
