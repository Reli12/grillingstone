// The Project Glossary (CONTEXT.md): readable term list, editable in place. Saves carry the version they
// edited; if a session or another tab changed the Glossary meanwhile, the save is refused and reloaded.
import { useState } from 'react'

import { useGlossary, useProject, useSaveGlossary } from '@/api/hooks/projects/projectHooks'
import { RawEditor } from '@/components/features/glossary/rawEditor/rawEditor'
import { TermsView } from '@/components/features/glossary/termsView/termsView'
import type { Editing } from '@/types/glossary'

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
