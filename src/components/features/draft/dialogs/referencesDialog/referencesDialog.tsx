// The References dialog: which other Drafts of the Project later sessions may read as context.
import type { Draft } from '#core/draft/draftTypes.ts'

import { useSetReferences } from '@/api/hooks/drafts/draftHooks'
import { useDrafts } from '@/api/hooks/projects/projectHooks'
import { Dialog } from '@/components/composite/dialog/dialog'

interface ReferencesDialogProps {
  open: boolean
  onClose: () => void
  draft: Draft
}

/** Picks the other written Drafts that later sessions may read as context. */
export function ReferencesDialog({ open, onClose, draft }: Readonly<ReferencesDialogProps>) {
  const { data: drafts } = useDrafts(draft.projectId)
  const setReferences = useSetReferences(draft.projectId, draft.id)
  // Only Drafts with a written version have anything to read.
  const others = drafts?.filter((other) => other.id !== draft.id && other.version > 0) ?? []
  return (
    <Dialog open={open} onClose={onClose} title="References">
      <p className="mb-3 text-sm text-ink-soft">
        Later sessions may read these Drafts as context. No hierarchy — each Draft stands on its own.
      </p>
      {others.length === 0 && <p className="text-sm text-ink-faint">No other written Drafts in this Project yet.</p>}
      <div className="space-y-1.5">
        {others.map((other) => {
          const on = draft.references.includes(other.id)
          const toggled = on
            ? draft.references.filter((reference) => reference !== other.id)
            : [...draft.references, other.id]
          return (
            <label
              key={other.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint"
            >
              <input
                type="checkbox"
                className="accent-claude"
                checked={on}
                onChange={() => setReferences.mutate(toggled)}
              />
              <span className="text-ink-faint">{other.workItemType}</span>
              {other.title}
            </label>
          )
        })}
      </div>
    </Dialog>
  )
}
