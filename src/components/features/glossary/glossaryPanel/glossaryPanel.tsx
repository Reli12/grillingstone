// The Project Glossary (CONTEXT.md): readable term list, editable in place. Saves carry the version they
// edited; if a session or another tab changed the Glossary meanwhile, the save is refused and reloaded.
import { useState } from 'react'

import { Plus } from 'lucide-react'

import { addTerm, parseGlossary, removeTerm, updateTerm } from '#core/glossary/glossary.ts'

import { useGlossary, useProject, useSaveGlossary } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TermEditor } from '@/components/features/glossary/termEditor/termEditor'
import { cn } from '@/lib/cn'

interface GlossaryPanelProps {
  projectId: string
  compact?: boolean
}

export function GlossaryPanel({ projectId, compact = false }: GlossaryPanelProps) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [raw, setRaw] = useState<string | null>(null)

  const { data: doc } = useGlossary(projectId)
  const { data: project } = useProject(projectId)
  const save = useSaveGlossary(projectId)

  if (!doc) return null
  const terms = parseGlossary(doc.markdown)
  const commit = (markdown: string) =>
    save.mutate({ markdown, baseVersion: doc.version }, { onSuccess: () => setEditing(null) })

  if (raw !== null)
    return (
      <div className="space-y-2">
        <TextArea
          minRows={14}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="font-mono text-[13px]"
          aria-label="CONTEXT.md"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ink"
            onClick={() => save.mutate({ markdown: raw, baseVersion: doc.version }, { onSuccess: () => setRaw(null) })}
          >
            Save CONTEXT.md
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setRaw(null)}>
            Cancel
          </Button>
        </div>
      </div>
    )

  return (
    <div>
      {terms.length === 0 && editing !== 'new' && (
        <p className="text-sm text-ink-soft">
          No terms yet. Claude adds them as they are settled during grilling, or add one yourself.
        </p>
      )}
      <dl className={cn('space-y-3', compact && 'space-y-2.5')}>
        {terms.map((t, i) =>
          editing === i ? (
            <TermEditor
              key={i}
              initial={t}
              onSave={(next) => commit(updateTerm(doc.markdown, i, next))}
              onCancel={() => setEditing(null)}
              onRemove={() => commit(removeTerm(doc.markdown, i))}
            />
          ) : (
            <button
              key={i}
              onClick={() => setEditing(i)}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-fog"
              title="Edit term"
            >
              <dt className="font-semibold text-ink">{t.term}</dt>
              <dd className="text-sm text-ink-soft">{t.definition}</dd>
              {t.avoid && <dd className="mt-0.5 text-[13px] text-ink-faint">Avoid: {t.avoid}</dd>}
            </button>
          ),
        )}
      </dl>
      {editing === 'new' && (
        <div className="mt-3">
          <TermEditor
            initial={{ term: '', definition: '', avoid: '' }}
            onSave={(t) => commit(addTerm(doc.markdown, t, project?.name))}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      <div className="mt-3 flex items-center gap-1">
        <Button size="sm" variant="quiet" onClick={() => setEditing('new')} disabled={editing !== null}>
          <Plus size={14} /> Add term
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setRaw(doc.markdown)} className="ml-auto">
          Edit as markdown
        </Button>
      </div>
    </div>
  )
}
