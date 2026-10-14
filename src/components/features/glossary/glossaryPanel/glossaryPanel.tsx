// The Project Glossary (CONTEXT.md) where it is maintained: a filterable one-line-per-term list, editable in
// place, or the whole markdown. Saves are checked against the Glossary as it was when the edit opened.
import { parseGlossary } from '#core/glossary/glossary.ts'

import { GlossaryToolbar } from '@/components/features/glossary/glossaryToolbar/glossaryToolbar'
import { RawEditor } from '@/components/features/glossary/rawEditor/rawEditor'
import { TermsView } from '@/components/features/glossary/termsView/termsView'
import { useGlossaryEditing } from '@/hooks/glossary/useGlossaryEditing'
import { useGlossaryFilter } from '@/hooks/glossary/useGlossaryFilter'
import { useTermFromUrl } from '@/hooks/glossary/useTermFromUrl'

export function GlossaryPanel({ projectId }: Readonly<{ projectId: string }>) {
  const filter = useGlossaryFilter()
  const editing = useGlossaryEditing(projectId, { onTermSaved: filter.keep })
  const highlighted = useTermFromUrl(editing.doc?.markdown)

  if (!editing.doc) return null
  const terms = parseGlossary(editing.doc.markdown)
  const rows = filter.rowsOf(terms, editing.edit?.name)
  const { raw } = editing
  return (
    <div>
      <GlossaryToolbar
        query={filter.query}
        onQueryChange={filter.setQuery}
        shown={rows.length}
        total={terms.length}
        rawOpen={raw !== null}
        termOpen={editing.edit !== null}
        onAdd={() => {
          filter.clear()
          editing.startNew()
        }}
        onEditRaw={editing.startRaw}
      />
      {raw === null ? (
        <TermsView rows={rows} total={terms.length} query={filter.query} editing={editing} highlighted={highlighted} />
      ) : (
        <RawEditor
          markdown={raw}
          status={editing}
          onChange={editing.setRaw}
          onSave={editing.saveRaw}
          onCancel={editing.cancel}
        />
      )}
    </div>
  )
}
