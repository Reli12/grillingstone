// The listed Glossary terms, one line each, with the open term's editor in place of its line.
import { type ReactNode } from 'react'

import { sameName } from '#core/glossary/glossary.ts'

import { TermLine } from '@/components/features/glossary/termLine/termLine'
import type { TermRow } from '@/types/glossary'

interface TermListProps {
  rows: TermRow[]
  /** The place in the whole Glossary of the term open in its editor, if it is listed. */
  editingIndex: number | null
  /** The open term's editor, shown in place of its line. */
  editor: ReactNode
  /** The name of the term a link opened the Glossary at, highlighted briefly. */
  highlighted: string | null
  onEdit: (row: TermRow) => void
}

/** Keys rows by name (and occurrence), so an open editor keeps its text when a live update moves its term. */
function rowKeys(rows: TermRow[]): string[] {
  const seen = new Map<string, number>()
  return rows.map(({ term }) => {
    const name = term.term.toLowerCase()
    const occurrence = seen.get(name) ?? 0
    seen.set(name, occurrence + 1)
    return `${name}#${occurrence}`
  })
}

export function TermList({ rows, editingIndex, editor, highlighted, onEdit }: Readonly<TermListProps>) {
  const keys = rowKeys(rows)
  return (
    <dl className="space-y-0.5">
      {rows.map((row, i) =>
        row.index === editingIndex ? (
          <div key={keys[i]} className="py-1">
            {editor}
          </div>
        ) : (
          <TermLine
            key={keys[i]}
            term={row.term}
            highlighted={!!highlighted && sameName(highlighted, row.term.term)}
            onEdit={() => onEdit(row)}
          />
        ),
      )}
    </dl>
  )
}
