// One term as a single line in the list; hovering shows its full definition, clicking opens its editor.
import { type GlossaryTerm, termAnchor } from '#core/glossary/glossary.ts'

import { cn } from '@/lib/cn'

interface TermLineProps {
  term: GlossaryTerm
  /** Briefly marked after a link opened the Glossary at this term. */
  highlighted?: boolean
  onEdit: () => void
}

/** One term as a single line in the list; hovering shows its full definition, clicking opens its editor. */
export function TermLine({ term, highlighted = false, onEdit }: Readonly<TermLineProps>) {
  return (
    <button
      id={termAnchor(term.term)}
      onClick={onEdit}
      title={term.definition}
      data-highlighted={highlighted}
      className={cn(
        'flex w-full scroll-mt-20 items-baseline gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-fog',
        highlighted && 'bg-mark-wash',
      )}
    >
      <dt className="shrink-0 font-semibold text-ink">{term.term}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm text-ink-soft">{term.definition}</dd>
      {term.avoid && (
        <dd className="hidden max-w-[35%] shrink-0 truncate text-[13px] text-ink-faint sm:block">
          Avoid: {term.avoid}
        </dd>
      )}
    </button>
  )
}
