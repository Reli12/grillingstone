// The Draft's Images on the Prototype start form: a thumbnail each, all ticked until the human unticks one.
import type { DraftImage } from '#core/prototype/prototypeRecords.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { cn } from '@/lib/cn'

interface StartFormImagesProps {
  projectId: string
  images: DraftImage[]
  isTicked: (image: DraftImage) => boolean
  onToggle: (image: DraftImage) => void
}

const DAY_FORMAT = { day: 'numeric', month: 'short', year: 'numeric' } as const
const dayOf = (iso: string) => new Date(iso).toLocaleDateString([], DAY_FORMAT)

/** The Draft's Images on the Prototype start form: a thumbnail each, all ticked until the human unticks one. */
export function StartFormImages({ projectId, images, isTicked, onToggle }: Readonly<StartFormImagesProps>) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-ink">Images from this Draft</legend>
      <p className="text-[13px] text-ink-soft">Claude is shown the ticked ones. Untick any that don’t help.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {images.map((image) => {
          const name = `Image ${image.number} of the Grilling Session of ${dayOf(image.startedAt)}`
          const ticked = isTicked(image)
          return (
            <li key={`${image.sessionId}:${image.number}`}>
              <label className="relative block cursor-pointer">
                <img
                  src={endpoints.sessionImage(projectId, image.sessionId, image.number)}
                  alt={name}
                  className={cn(
                    'size-20 rounded-md border object-cover',
                    ticked ? 'border-claude' : 'border-line opacity-45',
                  )}
                />
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => onToggle(image)}
                  aria-label={`Include ${name}`}
                  className="absolute top-1 left-1 size-4 cursor-pointer"
                />
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
