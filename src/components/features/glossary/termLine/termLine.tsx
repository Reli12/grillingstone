// One term as it reads in the list; clicking it opens the term's editor.
import { type GlossaryTerm } from '#core/glossary/glossary.ts'

/** One term as it reads in the list; clicking it opens the term's editor. */
export function TermLine({ term, onEdit }: Readonly<{ term: GlossaryTerm; onEdit: () => void }>) {
  return (
    <button onClick={onEdit} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-fog" title="Edit term">
      <dt className="font-semibold text-ink">{term.term}</dt>
      <dd className="text-sm text-ink-soft">{term.definition}</dd>
      {term.avoid && <dd className="mt-0.5 text-[13px] text-ink-faint">Avoid: {term.avoid}</dd>}
    </button>
  )
}
