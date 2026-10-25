// Tests for the Prototype start form: Images ticked by default and their running total against 20 MB, extra Images
// added like in the message box, the starting-Prototype picker with nothing preselected, and what Submit sends.
// Image preparation is stubbed: jsdom has no canvas.
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrototypeRow } from '#core/prototype/prototypeRecords.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import { PrototypeStartForm } from '@/components/features/prototypes/prototypeStartForm/prototypeStartForm'
import { type Preparation, prepareImage } from '@/lib/imagePreparation'
import { forgetImageSessions } from '@/lib/imageSessionMemory'
import { draftImageOf, finishedRow, prototypeBackend, sessionOf } from '@test/mocks/prototypeBackend'
import { render } from '@test/utils/testUtils'

vi.mock('@/lib/imagePreparation', () => ({ prepareImage: vi.fn() }))

const MEGABYTE = 1024 * 1024
const draft = v1Draft()
const picture = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })
const ready = (size: number): Preparation => ({ ok: true, image: { mediaType: 'image/png', data: 'AAAA', size } })

beforeEach(() => {
  forgetImageSessions()
  vi.mocked(prepareImage).mockReset()
  vi.mocked(prepareImage).mockResolvedValue(ready(1000))
})

function renderForm() {
  const onCancel = vi.fn()
  const onStarted = vi.fn()
  const view = render(
    <PrototypeStartForm projectId={draft.projectId} draftId={draft.id} onCancel={onCancel} onStarted={onStarted} />,
  )
  return { ...view, onCancel, onStarted }
}

const twoImages = [
  draftImageOf(1, { bytes: 1.5 * MEGABYTE }),
  draftImageOf(2, { bytes: 2 * MEGABYTE, startedAt: '2026-10-02T09:00:00Z' }),
]

describe('PrototypeStartForm Images', () => {
  it('shows every Image of the Draft as a thumbnail, all ticked, with the running total', async () => {
    prototypeBackend(draft, { images: twoImages })
    renderForm()

    const boxes = await screen.findAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    for (const box of boxes) expect(box).toBeChecked()
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('Images: 3.5 MB of 20 MB')).toBeInTheDocument()
  })

  it('takes an unticked Image out of the total and out of the request', async () => {
    const api = prototypeBackend(draft, { images: twoImages })
    const { user } = renderForm()

    await user.click((await screen.findAllByRole('checkbox'))[0])
    expect(screen.getByText('Images: 2.0 MB of 20 MB')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({ body: { tickedImages: [{ sessionId: 'sess-first', number: 2 }] } }),
      ),
    )
  })

  it('has no Image section when the Draft has no Images', async () => {
    prototypeBackend(draft)
    renderForm()

    // Submit waits for the Images to load, so an enabled Submit means there really are none.
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Images from this Draft/)).not.toBeInTheDocument()
  })

  it('disables Submit over 20 MB with the reason above it, and enables it again once enough is unticked', async () => {
    const images = [draftImageOf(1, { bytes: 12 * MEGABYTE }), draftImageOf(2, { bytes: 9 * MEGABYTE })]
    prototypeBackend(draft, { images })
    const { user } = renderForm()

    const reason = await screen.findByRole('alert')
    expect(reason).toHaveTextContent('more than 20 MB')
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()
    expect(reason.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(screen.getAllByRole('checkbox')[1])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(submit).toBeEnabled()
  })

  it('adds the Images attached on the form to the total and sends them', async () => {
    const api = prototypeBackend(draft, { images: [draftImageOf(1, { bytes: MEGABYTE })] })
    vi.mocked(prepareImage).mockResolvedValue(ready(2 * MEGABYTE))
    const { user } = renderForm()

    await screen.findAllByRole('checkbox')
    await user.upload(screen.getByLabelText('Image files'), picture('extra.png'))
    expect(await screen.findByRole('img', { name: 'extra.png' })).toBeInTheDocument()
    expect(screen.getByText('Images: 3.0 MB of 20 MB')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({
          body: {
            tickedImages: [{ sessionId: 'sess-first', number: 1 }],
            extraImages: [{ mediaType: 'image/png', data: 'AAAA' }],
          },
        }),
      ),
    )
  })

  it('counts an attached Image towards the 20 MB limit', async () => {
    prototypeBackend(draft, { images: [draftImageOf(1, { bytes: 19 * MEGABYTE })] })
    vi.mocked(prepareImage).mockResolvedValue(ready(2 * MEGABYTE))
    const { user } = renderForm()

    await screen.findAllByRole('checkbox')
    await user.upload(screen.getByLabelText('Image files'), picture())
    expect(await screen.findByRole('alert')).toHaveTextContent('more than 20 MB')
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })
})

describe('PrototypeStartForm starting Prototype', () => {
  const earlier = [
    finishedRow(draft, { id: 'proto-2', draftVersion: 2, writtenAt: '2026-10-25T10:00:00Z' }),
    finishedRow(draft, { id: 'proto-1', draftVersion: 1, writtenAt: '2026-10-20T10:00:00Z' }),
  ]

  it('offers this Draft’s earlier Prototypes by Draft version and time, with none preselected', async () => {
    prototypeBackend(draft, { rows: earlier })
    renderForm()

    const picker = await screen.findByRole('combobox', { name: /earlier Prototype/ })
    await screen.findByRole('option', { name: /^v2 · / })
    expect(picker).toHaveValue('')
    expect(screen.getByRole('option', { name: 'No starting Prototype' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /^v1 · / })).toBeInTheDocument()
  })

  it('offers no picker when the Draft has no Prototype yet', async () => {
    prototypeBackend(draft)
    renderForm()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('leaves out sessions that are not Prototypes: only finished rows can be started from', async () => {
    const running: PrototypeRow = { kind: 'running', session: sessionOf(draft) }
    const stopped: PrototypeRow = { kind: 'stopped', session: sessionOf(draft, { id: 'psess-2', status: 'stopped' }) }
    prototypeBackend(draft, { rows: [running, stopped, earlier[1]] })
    renderForm()
    // "No starting Prototype", and the one finished Prototype.
    expect(await screen.findAllByRole('option')).toHaveLength(2)
  })

  it('sends the chosen Prototype as the starting point and reports the start', async () => {
    const api = prototypeBackend(draft, { rows: earlier })
    const { user, onStarted } = renderForm()

    await screen.findByRole('option', { name: /^v1 · / })
    await user.selectOptions(screen.getByRole('combobox'), 'proto-1')
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => expect(onStarted).toHaveBeenCalled())
    expect(api.requests).toContainEqual(
      expect.objectContaining({ body: { tickedImages: [], startingPrototypeId: 'proto-1' } }),
    )
  })
})

describe('PrototypeStartForm', () => {
  it('starts without a starting Prototype or Images by default, and Cancel closes it', async () => {
    const api = prototypeBackend(draft)
    const { user, onCancel, onStarted } = renderForm()

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => expect(onStarted).toHaveBeenCalled())
    expect(api.requests).toContainEqual(expect.objectContaining({ body: { tickedImages: [] } }))
  })
})
