// The thin bar above a Prototype: the title of its Draft, the Draft version and time it was built from, how many
// assumptions it makes, and Download.
import type { Prototype } from '#core/prototype/prototypeRecords.ts'
import { plural } from '#core/shared/plural.ts'

import { DownloadLink } from '@/components/features/prototypes/downloadLink/downloadLink'
import { NO_DRAFT_LABEL, prototypeLabel } from '@/lib/prototypeLabel'

interface PrototypeViewerBarProps {
  prototype: Prototype
  /** Absent for a Prototype of no Draft. */
  draftTitle?: string
}

/** The thin bar above a Prototype: Draft title, version and time, number of assumptions, and Download. */
export function PrototypeViewerBar({ prototype, draftTitle }: Readonly<PrototypeViewerBarProps>) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-sheet px-4 py-2">
      <h1 className="min-w-0 truncate text-sm font-semibold text-ink">{draftTitle ?? NO_DRAFT_LABEL}</h1>
      <span className="text-[13px] text-ink-soft">{prototypeLabel(prototype)}</span>
      <span className="text-[13px] text-ink-soft">{plural(prototype.assumptions.length, 'assumption')}</span>
      <span className="ml-auto">
        <DownloadLink prototype={prototype} />
      </span>
    </div>
  )
}
