// Tests for Composer: sending on Enter and with the button, blocking while Claude replies, write-now and stop, and
// adding Images (paste, drop, picker) with their limits, hint and warning. Image preparation is stubbed: jsdom has no canvas.
import { createRef } from 'react'

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionBase } from '#core/session/sessionTypes.ts'

import { Composer } from '@/components/features/chat/composer/composer'
import { type Preparation, prepareImage } from '@/lib/imagePreparation'
import { forgetImageSessions } from '@/lib/imageSessionMemory'

vi.mock('@/lib/imagePreparation', () => ({ prepareImage: vi.fn() }))

const READY: Preparation = { ok: true, image: { mediaType: 'image/png', data: 'AAAA', size: 1000 } }
const MEGABYTE = 1024 * 1024
const NOT_AN_IMAGE = 'Only PNG, JPEG, WebP and GIF Images can be added.'

const session = (status: SessionBase['status'], id = 's1'): SessionBase => ({
  id,
  kind: 'first',
  status,
  writeConfirmed: false,
  startedAt: '',
})
/** A send that works: it reports back right away, so the Images leave the box. */
const sendThatWorks = (_text: string, _images: unknown, onSent: () => void) => onSent()
const handlers = () => ({ onSend: vi.fn(sendThatWorks), onWriteNow: vi.fn(), onStop: vi.fn() })
const anyCallback = expect.any(Function)
const picture = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })

beforeEach(() => {
  forgetImageSessions()
  vi.mocked(prepareImage).mockReset()
  vi.mocked(prepareImage).mockResolvedValue(READY)
})

describe('Composer', () => {
  it('sends on Enter, trimmed, and clears', async () => {
    const spies = handlers()
    render(<Composer session={session('waiting')} sending={false} {...spies} />)
    const box = screen.getByRole('textbox', { name: 'Message Claude' })
    await userEvent.type(box, ' Archive only {Enter}')
    expect(spies.onSend).toHaveBeenCalledWith('Archive only', [], anyCallback)
    expect(box).toHaveValue('')
  })

  it('keeps a new line on Shift+Enter and sends with the button', async () => {
    const spies = handlers()
    render(<Composer session={session('waiting')} sending={false} {...spies} />)
    await userEvent.type(screen.getByRole('textbox'), 'a{Shift>}{Enter}{/Shift}b')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(spies.onSend).toHaveBeenCalledWith('a\nb', [], anyCallback)
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

describe('Composer Images', () => {
  // Preparing an Image is asynchronous, so the list appears a moment after the paste, drop or pick.
  const thumbnails = () => screen.findByRole('list', { name: 'Images to send' })

  it('adds a thumbnail when an Image is pasted', async () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [picture('pasted.png')] } })
    expect(within(await thumbnails()).getByRole('img', { name: 'pasted.png' })).toBeInTheDocument()
  })

  it('leaves pasted text alone', () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [] } })
    expect(prepareImage).not.toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument()
  })

  it('adds a thumbnail when an Image is dropped on the box', async () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    fireEvent.drop(screen.getByRole('textbox'), { dataTransfer: { files: [picture('dropped.png')] } })
    expect(within(await thumbnails()).getByRole('img', { name: 'dropped.png' })).toBeInTheDocument()
  })

  it('adds an Image chosen with the image button', async () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    expect(screen.getByRole('button', { name: 'Add an Image' })).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Image files'), picture('picked.png'))
    expect(within(await thumbnails()).getByRole('img', { name: 'picked.png' })).toBeInTheDocument()
  })

  it('takes a thumbnail back with its ✕', async () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    await userEvent.upload(screen.getByLabelText('Image files'), picture('wrong.png'))
    await userEvent.click(await screen.findByRole('button', { name: 'Remove wrong.png' }))
    expect(screen.queryByRole('img', { name: 'wrong.png' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('sends Images with no text, and clears them', async () => {
    const spies = handlers()
    render(<Composer session={session('waiting')} sending={false} {...spies} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.upload(screen.getByLabelText('Image files'), picture())
    await screen.findByRole('img', { name: 'shot.png' })
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(spies.onSend).toHaveBeenCalledWith('', [{ mediaType: 'image/png', data: 'AAAA' }], anyCallback)
    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument()
  })

  it('keeps the thumbnails when the send fails, and counts them only once it has worked', async () => {
    // Never reports back: the send failed.
    const onSend = vi.fn<(text: string, images: unknown, onSent: () => void) => void>()
    render(<Composer session={session('waiting')} sending={false} {...handlers()} onSend={onSend} />)
    await userEvent.upload(screen.getByLabelText('Image files'), picture('kept.png'))
    await screen.findByRole('img', { name: 'kept.png' })
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'kept.png' })).toBeInTheDocument()

    act(() => onSend.mock.calls[0][2]()) // the retry works
    expect(await screen.findByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.queryByRole('img', { name: 'kept.png' })).not.toBeInTheDocument()
  })

  it('shows two refusals that read the same, and ignores a pasted untyped file so text still pastes', async () => {
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason: NOT_AN_IMAGE })
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [new File(['x'], 'data.bin')] } })
    expect(prepareImage).not.toHaveBeenCalled()

    const twoWithTheSameName = [new File(['x'], 'image.pdf'), new File(['y'], 'image.pdf')]
    fireEvent.drop(screen.getByRole('textbox'), { dataTransfer: { files: twoWithTheSameName } })
    expect(await screen.findAllByRole('alert')).toHaveLength(2)
  })

  it('refuses a dropped PDF with the type reason instead of ignoring it', async () => {
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason: NOT_AN_IMAGE })
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    const dropped = fireEvent.drop(screen.getByRole('textbox'), {
      dataTransfer: { files: [new File(['x'], 'spec.pdf', { type: 'application/pdf' })] },
    })
    // fireEvent returns false when a handler called preventDefault: the browser will not open the file.
    expect(dropped).toBe(false)
    expect(await screen.findByRole('alert')).toHaveTextContent(`spec.pdf: ${NOT_AN_IMAGE}`)
  })

  it('keeps Send disabled while it is not the human’s turn, even with an Image', async () => {
    render(<Composer session={session('thinking')} sending={false} {...handlers()} />)
    await userEvent.upload(screen.getByLabelText('Image files'), picture())
    await screen.findByRole('img', { name: 'shot.png' })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('refuses a sixth Image and says why', async () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    const files = Array.from({ length: 6 }, (_, i) => picture(`shot${i + 1}.png`))
    await userEvent.upload(screen.getByLabelText('Image files'), files)
    expect(await screen.findByRole('alert')).toHaveTextContent('A message can have at most 5 Images.')
    expect(within(await thumbnails()).getAllByRole('img')).toHaveLength(5)
  })

  it('says why a file was refused by the preparation', async () => {
    const reason = 'Only PNG, JPEG, WebP and GIF Images can be added.'
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason })
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    fireEvent.drop(screen.getByRole('textbox'), { dataTransfer: { files: [new File(['x'], 'photo.heic')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(`photo.heic: ${reason}`)
    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument()
  })

  it('shows the hint about sharing Images once per session', async () => {
    const spies = handlers()
    const { rerender } = render(<Composer session={session('waiting', 'a')} sending={false} {...spies} />)
    await userEvent.upload(screen.getByLabelText('Image files'), picture())
    expect(await screen.findByText(/Images are sent to Claude/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.queryByText(/Images are sent to Claude/)).not.toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Image files'), picture('again.png'))
    await screen.findByRole('img', { name: 'again.png' })
    expect(screen.queryByText(/Images are sent to Claude/)).not.toBeInTheDocument()

    // Another session gets its own hint.
    rerender(<Composer key="b" session={session('waiting', 'b')} sending={false} {...spies} />)
    await userEvent.upload(screen.getByLabelText('Image files'), picture('other.png'))
    expect(await screen.findByText(/Images are sent to Claude/)).toBeInTheDocument()
  })

  it('warns once the session’s Images add up to about 20 MB', async () => {
    render(<Composer session={session('waiting')} sending={false} {...handlers()} />)
    await userEvent.upload(screen.getByLabelText('Image files'), picture('big1.png'))
    await screen.findByRole('img', { name: 'big1.png' })
    expect(screen.queryByText(/about 20 MB/)).not.toBeInTheDocument()

    vi.mocked(prepareImage).mockResolvedValue({ ok: true, image: { ...READY.image, size: 4 * MEGABYTE } })
    const bigOnes = Array.from({ length: 4 }, (_, i) => picture(`big${i + 2}.png`))
    await userEvent.upload(screen.getByLabelText('Image files'), bigOnes)
    // 1000 bytes + 16 MB is still under the line; the Images already sent count towards it too.
    expect(screen.queryByText(/about 20 MB/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    vi.mocked(prepareImage).mockResolvedValue({ ok: true, image: { ...READY.image, size: 5 * MEGABYTE } })
    await userEvent.upload(screen.getByLabelText('Image files'), picture('last.png'))
    expect(await screen.findByText(/about 20 MB/)).toBeInTheDocument()
  })

  it('offers no Images when the session takes none', () => {
    render(<Composer session={session('waiting')} sending={false} allowImages={false} {...handlers()} />)
    expect(screen.queryByRole('button', { name: 'Add an Image' })).not.toBeInTheDocument()
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [picture()] } })
    expect(prepareImage).not.toHaveBeenCalled()
  })
})
