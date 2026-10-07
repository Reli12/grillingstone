// How many recognised terms the preview names before it trails off with "…".
import { AlertTriangle } from 'lucide-react'

import { type GlossaryTerm } from '#core/glossary/glossary.ts'

/** How many recognised terms the preview names before it trails off with "…". */
const NAMED_TERMS = 6

/** Under the preview: which terms the Glossary parser recognised, or a warning that it found none. */
export function RecognisedTerms({ terms }: Readonly<{ terms: GlossaryTerm[] }>) {
  if (!terms.length)
    return (
      <p className="flex items-start gap-2 text-[13px] text-mark-ink">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        No terms in the Glossary format were found. Claude will still read it, but the Glossary panel won’t list its
        terms.
      </p>
    )
  const named = terms
    .slice(0, NAMED_TERMS)
    .map((term) => term.term)
    .join(', ')
  return (
    <p className="text-[13px] text-proof">
      {terms.length} term{terms.length === 1 ? '' : 's'} recognised
      <span className="text-ink-faint">
        : {named}
        {terms.length > NAMED_TERMS ? ', …' : ''}
      </span>
    </p>
  )
}
