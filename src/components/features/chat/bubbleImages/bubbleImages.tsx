// The numbered thumbnails under a human message in the Transcript; each opens the saved Image at full size.
import type { ImageRef } from '#core/session/images.ts'

interface BubbleImagesProps {
  images: ImageRef[]
  /** Where the saved Image with this number is served from. */
  imageUrl: (number: number) => string
}

/** The numbered thumbnails under a human message in the Transcript; each opens the saved Image at full size. */
export function BubbleImages({ images, imageUrl }: Readonly<BubbleImagesProps>) {
  return (
    <ul aria-label="Images sent" className="flex flex-wrap justify-end gap-2">
      {images.map(({ number }) => (
        <li key={number}>
          <a
            href={imageUrl(number)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open Image ${number} at full size`}
            className="relative block"
          >
            <img
              src={imageUrl(number)}
              alt={`Image ${number}`}
              className="size-20 rounded-md border border-line object-cover"
            />
            <span aria-hidden className="absolute bottom-1 left-1 rounded bg-ink px-1.5 text-[11px] text-on-ink">
              {number}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
