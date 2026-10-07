// The readable Glossary: the term list, the new-term editor, and the ways into editing.
import { addTerm, type GlossaryTerm, parseGlossary } from '#core/glossary/glossary.ts'

import { GlossaryActions } from '@/components/features/glossary/glossaryActions/glossaryActions'
import { TermEditor } from '@/components/features/glossary/termEditor/termEditor'
import { TermList } from '@/components/features/glossary/termList/termList'
import type { Editing } from '@/types/glossary'

const EMPTY_TERM: GlossaryTerm = { term: '', definition: '', avoid: '' }

interface TermsViewProps {
  markdown: string
  projectName?: string
  compact: boolean
  /** The index of the term being edited, 'new' while adding one, or null. */
  editing: Editing
  onEditingChange: (editing: Editing) => void
  onCommit: (markdown: string) => void
  onEditRaw: () => void
}

/** The readable Glossary: the term list, the new-term editor, and the ways into editing. */
export function TermsView({
  markdown,
  projectName,
  compact,
  editing,
  onEditingChange,
  onCommit,
  onEditRaw,
}: Readonly<TermsViewProps>) {
  const stopEditing = () => onEditingChange(null)
  const empty = parseGlossary(markdown).length === 0
  return (
    <div>
      {empty && editing !== 'new' && (
        <p className="text-sm text-ink-soft">
          No terms yet. Claude adds them as they are settled during grilling, or add one yourself.
        </p>
      )}
      <TermList
        markdown={markdown}
        compact={compact}
        editingIndex={typeof editing === 'number' ? editing : null}
        onEdit={onEditingChange}
        onCancel={stopEditing}
        onCommit={onCommit}
      />
      {editing === 'new' && (
        <div className="mt-3">
          <TermEditor
            initial={EMPTY_TERM}
            onSave={(term) => onCommit(addTerm(markdown, term, projectName))}
            onCancel={stopEditing}
          />
        </div>
      )}
      <GlossaryActions canAdd={editing === null} onAdd={() => onEditingChange('new')} onEditRaw={onEditRaw} />
    </div>
  )
}
