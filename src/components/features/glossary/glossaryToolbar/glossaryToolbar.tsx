// The Glossary tab's bar, kept in view while the list scrolls: the filter, how many terms show, and the actions.
import { plural } from '#core/shared/plural.ts'

import { GlossaryActions } from '@/components/features/glossary/glossaryActions/glossaryActions'
import { GlossaryFilter } from '@/components/features/glossary/glossaryFilter/glossaryFilter'

interface GlossaryToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  shown: number
  total: number
  /** The whole markdown is being edited: filter and actions wait. */
  rawOpen: boolean
  /** A term is open in its editor: the actions wait. */
  termOpen: boolean
  onAdd: () => void
  onEditRaw: () => void
}

const countLabel = (shown: number, total: number, filtering: boolean) =>
  filtering ? `${shown} of ${total}` : plural(total, 'term')

export function GlossaryToolbar({
  query,
  onQueryChange,
  shown,
  total,
  rawOpen,
  termOpen,
  onAdd,
  onEditRaw,
}: Readonly<GlossaryToolbarProps>) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 bg-fog py-3">
      <GlossaryFilter value={query} onChange={onQueryChange} disabled={rawOpen} />
      <span className="text-[13px] whitespace-nowrap text-ink-faint">
        {countLabel(shown, total, !rawOpen && query.trim() !== '')}
      </span>
      <GlossaryActions disabled={rawOpen || termOpen} onAdd={onAdd} onEditRaw={onEditRaw} />
    </div>
  )
}
