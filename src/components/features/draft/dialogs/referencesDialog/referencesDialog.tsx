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
export function ReferencesDialog({ open, onClose, draft }: ReferencesDialogProps) {
  const { data: drafts } = useDrafts(draft.projectId)
  const set = useSetReferences(draft.projectId, draft.id)
  const others = drafts?.filter((d) => d.id !== draft.id && d.version > 0) ?? []
  return (
    <Dialog open={open} onClose={onClose} title="References">
      <p className="mb-3 text-sm text-ink-soft">Later sessions may read these Drafts as context. No hierarchy — each Draft stands on its own.</p>
      {others.length === 0 && <p className="text-sm text-ink-faint">No other written Drafts in this Project yet.</p>}
      <div className="space-y-1.5">
        {others.map((d) => {
          const on = draft.references.includes(d.id)
          return (
            <label key={d.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint">
              <input type="checkbox" className="accent-claude" checked={on} onChange={() => set.mutate(on ? draft.references.filter((r) => r !== d.id) : [...draft.references, d.id])} />
              <span className="text-ink-faint">{d.workItemType}</span>
              {d.title}
            </label>
          )
        })}
      </div>
    </Dialog>
  )
}
