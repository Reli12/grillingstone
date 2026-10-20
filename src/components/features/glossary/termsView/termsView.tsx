// The listed Glossary: the (filtered) term lines, the open term's editor, and what to say when nothing is listed.
import { TermEditor } from '@/components/features/glossary/termEditor/termEditor'
import { TermList } from '@/components/features/glossary/termList/termList'
import type { useGlossaryEditing } from '@/hooks/glossary/useGlossaryEditing'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import type { TermRow } from '@/types/glossary'

/** The list place of an open term no longer in the Glossary shown (a live update removed or renamed it). */
const GONE = -1

interface TermsViewProps {
  rows: TermRow[]
  /** How many terms the whole Glossary has. */
  total: number
  query: string
  editing: ReturnType<typeof useGlossaryEditing>
  highlighted: string | null
}

/** The listed Glossary: the (filtered) term lines, the open term's editor, and what to say when nothing is listed. */
export function TermsView({ rows, total, query, editing, highlighted }: Readonly<TermsViewProps>) {
  const assistant = useAssistantLabel()
  const { edit } = editing
  const editor = edit && (
    <TermEditor
      initial={edit.term}
      status={editing}
      onSave={editing.saveTerm}
      onCancel={editing.cancel}
      onRemove={edit.index === null ? undefined : editing.removeTerm}
    />
  )
  const isNew = edit?.name === ''
  // An open term that vanished from the list keeps a line at the end, so its editor keeps the typed text.
  const gone = !!edit && !isNew && editing.editingIndex === null
  const listed = gone ? [...rows, { term: edit.term, index: GONE }] : rows
  return (
    <div className="rounded-lg border border-line bg-sheet p-2">
      {total === 0 && !edit && (
        <p className="p-2 text-sm text-ink-soft">
          No terms yet. {assistant} adds them as they are settled during grilling, or add one yourself.
        </p>
      )}
      {total > 0 && listed.length === 0 && (
        <p className="p-2 text-sm text-ink-soft">No terms match "{query.trim()}".</p>
      )}
      <TermList
        rows={listed}
        editingIndex={gone ? GONE : editing.editingIndex}
        editor={editor}
        highlighted={highlighted}
        onEdit={(row) => editing.startTerm(row.index, row.term)}
      />
      {isNew && <div className="mt-2">{editor}</div>}
    </div>
  )
}
