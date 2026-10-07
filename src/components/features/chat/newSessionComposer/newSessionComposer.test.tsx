// Tests for NewSessionComposer: starting a session, blank text, the blocked state and "Starting…".
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NewSessionComposer } from '@/components/features/chat/newSessionComposer/newSessionComposer'

describe('NewSessionComposer', () => {
  it('starts a session with the trimmed message', async () => {
    const onStart = vi.fn()
    render(<NewSessionComposer placeholder="Message" hint="A hint" starting={false} onStart={onStart} />)
    expect(screen.getByText('A hint')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), ' More context {Enter}')
    expect(onStart).toHaveBeenCalledWith('More context')
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('starts with the button, not with blank text', async () => {
    const onStart = vi.fn()
    render(<NewSessionComposer placeholder="Message" starting={false} onStart={onStart} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), '  {Enter}x')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onStart.mock.calls).toEqual([['x']])
  })

  it('is blocked with a reason', () => {
    render(
      <NewSessionComposer
        placeholder="Message"
        blockedReason="Triage first"
        hint="hidden"
        starting={false}
        onStart={() => {}}
      />,
    )
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByPlaceholderText('Triage first')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('shows that it is starting', () => {
    render(<NewSessionComposer placeholder="Message" starting onStart={() => {}} />)
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  })
})
