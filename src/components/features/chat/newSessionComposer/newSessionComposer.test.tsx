// Tests for NewSessionComposer: starting a session (with Images), blank text, the blocked state and "Starting…".
// Image preparation is stubbed: jsdom has no canvas.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NewSessionComposer } from '@/components/features/chat/newSessionComposer/newSessionComposer'
import { prepareImage } from '@/lib/imagePreparation'
import { forgetImageSessions, sessionImageBytes, wasHinted } from '@/lib/imageSessionMemory'

vi.mock('@/lib/imagePreparation', () => ({ prepareImage: vi.fn() }))

const anyCallback = expect.any(Function)

beforeEach(() => {
  forgetImageSessions()
  vi.mocked(prepareImage).mockReset()
  vi.mocked(prepareImage).mockResolvedValue({ ok: true, image: { mediaType: 'image/png', data: 'AAAA', size: 1000 } })
})

describe('NewSessionComposer', () => {
  it('starts a session with the trimmed message', async () => {
    const onStart = vi.fn()
    render(<NewSessionComposer placeholder="Message" hint="A hint" starting={false} onStart={onStart} />)
    expect(screen.getByText('A hint')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), ' More context {Enter}')
    expect(onStart).toHaveBeenCalledWith('More context', [], anyCallback)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('starts with the button, not with blank text', async () => {
    const onStart = vi.fn()
    render(<NewSessionComposer placeholder="Message" starting={false} onStart={onStart} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), '  {Enter}x')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onStart.mock.calls).toEqual([['x', [], anyCallback]])
  })

  it('starts with Images in the first message, with or without words', async () => {
    // A start that works reports the id of the session it started.
    const onStart = vi.fn((_text: string, _images: unknown, onStarted: (id: string) => void) => onStarted('sess-1'))
    render(<NewSessionComposer placeholder="Message" starting={false} onStart={onStart} />)
    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: { files: [new File(['x'], 'frame.png', { type: 'image/png' })] },
    })
    expect(await screen.findByRole('img', { name: 'frame.png' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), 'Grill me on this frame')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onStart).toHaveBeenCalledWith(
      'Grill me on this frame',
      [{ mediaType: 'image/png', data: 'AAAA' }],
      anyCallback,
    )

    await userEvent.upload(screen.getByLabelText('Image files'), new File(['x'], 'again.png', { type: 'image/png' }))
    await screen.findByRole('img', { name: 'again.png' })
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onStart).toHaveBeenLastCalledWith('', [{ mediaType: 'image/png', data: 'AAAA' }], anyCallback)
  })

  it('moves the one-time hint to the session it started, and not to another Draft’s box', async () => {
    const onStart = vi.fn((_text: string, _images: unknown, onStarted: (id: string) => void) => onStarted('sess-1'))
    const first = render(<NewSessionComposer placeholder="M" starting={false} onStart={onStart} sessionKey="draft-a" />)
    await userEvent.upload(screen.getByLabelText('Image files'), new File(['x'], 'a.png', { type: 'image/png' }))
    expect(await screen.findByText(/Images are sent to Claude/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    first.unmount()

    // Another Draft's box has not shown its hint yet.
    render(<NewSessionComposer placeholder="M" starting={false} onStart={onStart} sessionKey="draft-b" />)
    await userEvent.upload(screen.getByLabelText('Image files'), new File(['x'], 'b.png', { type: 'image/png' }))
    expect(await screen.findByText(/Images are sent to Claude/)).toBeInTheDocument()
    expect(wasHinted('sess-1')).toBe(true)
    expect(wasHinted('draft-a')).toBe(false)
    expect(sessionImageBytes('sess-1')).toBe(1000)
    expect(sessionImageBytes('draft-a')).toBe(0)
  })

  it('keeps the thumbnails when the start fails', async () => {
    const onStart = vi.fn() // never reports back
    render(<NewSessionComposer placeholder="Message" starting={false} onStart={onStart} />)
    await userEvent.upload(screen.getByLabelText('Image files'), new File(['x'], 'kept.png', { type: 'image/png' }))
    await screen.findByRole('img', { name: 'kept.png' })
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('img', { name: 'kept.png' })).toBeInTheDocument()
  })

  it('offers no Images for the first message of a Continuation', () => {
    render(
      <NewSessionComposer
        placeholder="Message"
        starting={false}
        onStart={() => {}}
        continuing={{ label: 'First session', onCancel: () => {} }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Add an Image' })).not.toBeInTheDocument()
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
