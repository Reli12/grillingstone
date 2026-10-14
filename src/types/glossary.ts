// The Glossary term open in its editor, and a term as the (possibly filtered) list shows it.
import type { GlossaryTerm } from '#core/glossary/glossary.ts'

/** The term open in its editor: its place in the Glossary the edit started from (null for a new term), its name, and
 *  the term as it was when the editor opened. */
export interface TermEdit {
  index: number | null
  name: string
  term: GlossaryTerm
}

/** A listed term and its place in the whole Glossary, so editing a filtered row edits the right term. */
export interface TermRow {
  term: GlossaryTerm
  index: number
}

/** How saving the open edit goes: in flight, refused because the Glossary changed meanwhile, or failed. */
export interface SaveStatus {
  saving: boolean
  stale: boolean
  failure: string | null
}
