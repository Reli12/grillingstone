// Tests for HumanBubble: the words, and the numbered thumbnails that open the saved Image at full size.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HumanBubble } from '@/components/features/chat/humanBubble/humanBubble'
import type { HumanMessage } from '@/types/chat'

const message = (extra: Partial<HumanMessage> = {}): HumanMessage => ({
  id: 'm1',
  at: '',
  role: 'human',
  kind: 'message',
  text: 'Look at this',
  ...extra,
})
const imageUrl = (number: number) => `/api/projects/p/sessions/s/images/${number}`

describe('HumanBubble', () => {
  it('shows the words of a message without Images as before', () => {
    render(<HumanBubble message={message()} imageUrl={imageUrl} />)
    expect(screen.getByText('Look at this')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Images sent' })).not.toBeInTheDocument()
  })

  it('shows each Image as a numbered thumbnail that opens it at full size', () => {
    const images = [
      { number: 3, mediaType: 'image/png' as const },
      { number: 4, mediaType: 'image/jpeg' as const },
    ]
    render(<HumanBubble message={message({ images })} imageUrl={imageUrl} />)
    const list = screen.getByRole('list', { name: 'Images sent' })
    expect(within(list).getByRole('img', { name: 'Image 3' })).toHaveAttribute('src', imageUrl(3))
    const link = within(list).getByRole('link', { name: 'Open Image 4 at full size' })
    expect(link).toHaveAttribute('href', imageUrl(4))
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText('Look at this')).toBeInTheDocument()
  })

  it('shows only the thumbnails for an Images-only message', () => {
    const images = [{ number: 1, mediaType: 'image/png' as const }]
    const { container } = render(<HumanBubble message={message({ text: '', images })} imageUrl={imageUrl} />)
    expect(screen.getByRole('img', { name: 'Image 1' })).toBeInTheDocument()
    expect(container.querySelector('p')).toBeNull()
  })

  it('leaves out the thumbnails where no Image address is known', () => {
    const images = [{ number: 1, mediaType: 'image/png' as const }]
    render(<HumanBubble message={message({ images })} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
