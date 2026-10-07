// The Glossary's terms, each readable or open in its editor.
import { parseGlossary, removeTerm, updateTerm } from '#core/glossary/glossary.ts'

import { TermEditor } from '@/components/features/glossary/termEditor/termEditor'
import { TermLine } from '@/components/features/glossary/termLine/termLine'
import { cn } from '@/lib/cn'

interface TermListProps {
  markdown: string
  compact: boolean
  /** The term open in its editor, if any. */
  editingIndex: number | null
  onEdit: (index: number) => void
  onCancel: () => void
  /** Saves the Glossary as rewritten by an edit or removal. */
  onCommit: (markdown: string) => void
}

export function TermList({ markdown, compact, editingIndex, onEdit, onCancel, onCommit }: Readonly<TermListProps>) {
  return (
    <dl className={cn('space-y-3', compact && 'space-y-2.5')}>
      {parseGlossary(markdown).map((term, i) =>
        editingIndex === i ? (
          <TermEditor
            key={i}
            initial={term}
            onSave={(next) => onCommit(updateTerm(markdown, i, next))}
            onCancel={onCancel}
            onRemove={() => onCommit(removeTerm(markdown, i))}
          />
        ) : (
          <TermLine key={i} term={term} onEdit={() => onEdit(i)} />
        ),
      )}
    </dl>
  )
}
