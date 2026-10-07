// The Project Glossary (CONTEXT.md): readable term list, editable in place. Saves carry the version they
// edited; if a session or another tab changed the Glossary meanwhile, the save is refused and reloaded.
import { useState } from 'react'

import { Plus } from 'lucide-react'

import { addTerm, type GlossaryTerm, parseGlossary, removeTerm, updateTerm } from '#core/glossary/glossary.ts'

import { useGlossary, useProject, useSaveGlossary } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TermEditor } from '@/components/features/glossary/termEditor/termEditor'
import { cn } from '@/lib/cn'

const EMPTY_TERM: GlossaryTerm = { term: '', definition: '', avoid: '' }

interface RawEditorProps {
  markdown: string
  onChange: (markdown: string) => void
  onSave: () => void
  onCancel: () => void
}

/** The whole CONTEXT.md as one text box, for edits the term list can't express. */
function RawEditor({ markdown, onChange, onSave, onCancel }: Readonly<RawEditorProps>) {
  return (
    <div className="space-y-2">
      <TextArea
        minRows={14}
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono text-[13px]"
        aria-label="CONTEXT.md"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ink" onClick={onSave}>
          Save CONTEXT.md
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** One term as it reads in the list; clicking it opens the term's editor. */
function TermLine({ term, onEdit }: Readonly<{ term: GlossaryTerm; onEdit: () => void }>) {
  return (
    <button onClick={onEdit} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-fog" title="Edit term">
      <dt className="font-semibold text-ink">{term.term}</dt>
      <dd className="text-sm text-ink-soft">{term.definition}</dd>
      {term.avoid && <dd className="mt-0.5 text-[13px] text-ink-faint">Avoid: {term.avoid}</dd>}
    </button>
  )
}

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

function TermList({ markdown, compact, editingIndex, onEdit, onCancel, onCommit }: Readonly<TermListProps>) {
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

interface GlossaryActionsProps {
  /** Adding waits until no term is open in an editor. */
  canAdd: boolean
  onAdd: () => void
  onEditRaw: () => void
}

function GlossaryActions({ canAdd, onAdd, onEditRaw }: Readonly<GlossaryActionsProps>) {
  return (
    <div className="mt-3 flex items-center gap-1">
      <Button size="sm" variant="quiet" onClick={onAdd} disabled={!canAdd}>
        <Plus size={14} /> Add term
      </Button>
      <Button size="sm" variant="quiet" onClick={onEditRaw} className="ml-auto">
        Edit as markdown
      </Button>
    </div>
  )
}

type Editing = number | 'new' | null

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
function TermsView({
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

interface GlossaryPanelProps {
  projectId: string
  compact?: boolean
}

export function GlossaryPanel({ projectId, compact = false }: Readonly<GlossaryPanelProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  /** The raw CONTEXT.md being edited, or null while the term list shows. */
  const [raw, setRaw] = useState<string | null>(null)

  const { data: doc } = useGlossary(projectId)
  const { data: project } = useProject(projectId)
  const save = useSaveGlossary(projectId)

  if (!doc) return null
  const saveThen = (markdown: string, done: () => void) =>
    save.mutate({ markdown, baseVersion: doc.version }, { onSuccess: done })
  const commit = (markdown: string) => saveThen(markdown, () => setEditing(null))

  if (raw !== null)
    return (
      <RawEditor
        markdown={raw}
        onChange={setRaw}
        onSave={() => saveThen(raw, () => setRaw(null))}
        onCancel={() => setRaw(null)}
      />
    )

  return (
    <TermsView
      markdown={doc.markdown}
      projectName={project?.name}
      compact={compact}
      editing={editing}
      onEditingChange={setEditing}
      onCommit={commit}
      onEditRaw={() => setRaw(doc.markdown)}
    />
  )
}
