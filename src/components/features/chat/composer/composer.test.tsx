// Tests for Composer: sending on Enter and with the button, blocking while Claude replies, write-now and stop.
import { createRef } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SessionBase } from '#core/session/sessionTypes.ts'

import { Composer } from '@/components/features/chat/composer/composer'

const session = (status: SessionBase['status'], assistant: SessionBase['assistant'] = 'claude'): SessionBase => ({
  id: 's1',
  kind: 'first',
  status,
  assistant,
  writeConfirmed: false,
  startedAt: '',
})
const handlers = () => ({ onSend: vi.fn(), onWriteNow: vi.fn(), onStop: vi.fn() })

describe('Composer', () => {
  it('sends on Enter, trimmed, and clears', async () => {
    const spies = handlers()
    render(<Composer session={session('waiting')} sending={false} {...spies} />)
    const box = screen.getByRole('textbox', { name: 'Message Claude' })
    await userEvent.type(box, ' Archive only {Enter}')
    expect(spies.onSend).toHaveBeenCalledWith('Archive only')
    expect(box).toHaveValue('')
  })

  it('keeps a new line on Shift+Enter and sends with the button', async () => {
    const spies = handlers()
    render(<Composer session={session('waiting')} sending={false} {...spies} />)
    await userEvent.type(screen.getByRole('textbox'), 'a{Shift>}{Enter}{/Shift}b')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(spies.onSend).toHaveBeenCalledWith('a\nb')
  })

  it('does not send blank text or while Claude is replying', async () => {
    const spies = handlers()
    const { rerender } = render(<Composer session={session('waiting')} sending={false} {...spies} />)
    await userEvent.type(screen.getByRole('textbox'), '   {Enter}')
    rerender(<Composer session={session('thinking')} sending={false} {...spies} />)
    await userEvent.type(screen.getByRole('textbox'), 'hi{Enter}')
    expect(spies.onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('names the Assistant that holds the session', () => {
    render(<Composer session={session('thinking', 'codex')} sending={false} {...handlers()} />)
    expect(screen.getByRole('textbox', { name: 'Message Codex' })).toHaveAttribute('placeholder', 'Codex is replying…')
  })

  it('writes now or stops', async () => {
    const spies = handlers()
    render(<Composer session={session('waiting')} sending={false} {...spies} />)
    await userEvent.click(screen.getByRole('button', { name: 'Enough — write it' }))
    await userEvent.click(screen.getByRole('button', { name: /Stop/ }))
    expect(spies.onWriteNow).toHaveBeenCalled()
    expect(spies.onStop).toHaveBeenCalled()
  })

  it('exposes the textarea for focusing', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Composer ref={ref} session={session('waiting')} sending={false} {...handlers()} />)
    expect(ref.current).toBe(screen.getByRole('textbox'))
  })
})
