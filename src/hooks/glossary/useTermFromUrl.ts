// A link like ?term=Draft: once the Glossary has loaded, scroll to that term and highlight it briefly.
// The term is looked up once per link, so later live updates never jump the list; an unknown term is ignored.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { findTerm, parseGlossary, termAnchor } from '#core/glossary/glossary.ts'

const HIGHLIGHT_MS = 2000

/** The name of the term highlighted now, or null. */
export function useTermFromUrl(markdown: string | undefined): string | null {
  const [params] = useSearchParams()
  const wanted = params.get('term')
  /** The link last looked up, and the term it found (null once the highlight is over, or when there was none). */
  const [found, setFound] = useState<{ wanted: string; name: string | null } | null>(null)

  if (markdown !== undefined && wanted && found?.wanted !== wanted) {
    const index = findTerm(markdown, wanted)
    setFound({ wanted, name: index < 0 ? null : parseGlossary(markdown)[index].term })
  }
  const name = found?.name ?? null

  useEffect(() => {
    if (!name) return
    document.getElementById(termAnchor(name))?.scrollIntoView({ block: 'center' })
    const timer = setTimeout(() => setFound((last) => last && { ...last, name: null }), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [name])

  return name
}
