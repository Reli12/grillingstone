// The Images added to the message being written, as thumbnails above the box, each with a ✕ to take it back.
import { X } from 'lucide-react'

import type { PendingImage } from '@/types/chat'

interface ImageThumbnailsProps {
  pending: PendingImage[]
  onRemove: (id: string) => void
}

const dataUrlOf = ({ image }: PendingImage) => `data:${image.mediaType};base64,${image.data}`

/** The Images added to the message being written, as thumbnails above the box, each with a ✕ to take it back. */
export function ImageThumbnails({ pending, onRemove }: Readonly<ImageThumbnailsProps>) {
  if (!pending.length) return null
  return (
    <ul aria-label="Images to send" className="flex flex-wrap gap-2 px-3 pt-2.5">
      {pending.map((item, i) => {
        const name = item.fileName || `Image ${i + 1}`
        return (
          <li key={item.id} className="relative">
            <img src={dataUrlOf(item)} alt={name} className="size-14 rounded-md border border-line object-cover" />
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => onRemove(item.id)}
              className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full bg-ink text-on-ink"
            >
              <X size={12} aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
