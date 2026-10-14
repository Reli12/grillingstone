// The Glossary tab's filter: which terms are listed for the text typed. A term being edited or just saved
// stays listed until the text changes, so it never seems to vanish.
import { useState } from 'react'

import { type GlossaryTerm, matchesTerm, sameName } from '#core/glossary/glossary.ts'

import type { TermRow } from '@/types/glossary'

export function useGlossaryFilter() {
  const [query, setQueryText] = useState('')
  /** The just-saved term's name, kept listed while the filter stays as it is. */
  const [kept, setKept] = useState<string | null>(null)

  const setQuery = (text: string) => {
    setQueryText(text)
    setKept(null)
  }

  /** The terms to list, each with its place in the whole Glossary; `editing` is the open term's name. */
  const rowsOf = (terms: GlossaryTerm[], editing?: string): TermRow[] => {
    const pinned = [kept, editing].filter((name): name is string => !!name)
    return terms
      .map((term, index) => ({ term, index }))
      .filter(({ term }) => matchesTerm(term, query) || pinned.some((name) => sameName(name, term.term)))
  }

  return { query, setQuery, keep: setKept, clear: () => setQuery(''), rowsOf }
}
