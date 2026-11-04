// The strip of a Prototype Grilling Session's Prototypes, oldest round first: flip between them to compare rounds.
import type { Prototype } from '#core/prototype/prototypeRecords.ts'

import { cn } from '@/lib/cn'
import { roundLabel } from '@/lib/prototypeLabel'

interface VersionStripProps {
  prototypes: Prototype[]
  /** The id of the Prototype in the frame. */
  currentId: string
  onSelect: (prototypeId: string) => void
}

/** The session's Prototypes as buttons labelled by round and, when it has one, Draft version. */
export function VersionStrip({ prototypes, currentId, onSelect }: Readonly<VersionStripProps>) {
  return (
    <ul aria-label="Prototypes of this session" className="flex flex-wrap gap-1.5">
      {prototypes.map((prototype) => (
        <li key={prototype.id}>
          <button
            type="button"
            aria-pressed={prototype.id === currentId}
            onClick={() => onSelect(prototype.id)}
            className={cn(
              'h-7 cursor-pointer rounded-md border px-2.5 text-[13px] font-medium',
              prototype.id === currentId
                ? 'border-claude bg-claude/10 text-ink'
                : 'border-line bg-sheet text-ink-soft hover:border-ink-faint',
            )}
          >
            {roundLabel(prototype)}
          </button>
        </li>
      ))}
    </ul>
  )
}
