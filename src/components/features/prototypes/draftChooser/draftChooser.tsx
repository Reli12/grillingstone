// Asks which Draft a Prototype is of, before the start form: only Drafts at v1 or later are offered, since an earlier
// one has nothing to illustrate. A Draft that already has a Prototype being written is shown but can't be picked.
import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { Button } from '@/components/atoms/button/button'

interface DraftChooserProps {
  drafts: DraftSummary[]
  /** Ids of the Drafts a Prototype is being written for. */
  writing: ReadonlySet<string>
  onChoose: (draftId: string) => void
  onCancel: () => void
}

/** Asks which Draft a Prototype is of, offering only Drafts at v1 or later. */
export function DraftChooser({ drafts, writing, onChoose, onCancel }: Readonly<DraftChooserProps>) {
  const offered = drafts.filter((draft) => draft.version >= 1)
  return (
    <fieldset className="space-y-2 rounded-lg border border-line bg-sheet p-4">
      <legend className="px-1 text-sm font-medium text-ink">Which Draft is the Prototype of?</legend>
      {offered.length === 0 && (
        <p className="text-sm text-ink-soft">
          No Draft has reached v1 yet. A Prototype needs a Draft at v1 or later, so there is something to illustrate.
        </p>
      )}
      <ul className="space-y-1.5">
        {offered.map((draft) => (
          <li key={draft.id}>
            <Button
              className="h-auto w-full justify-between py-2 text-left whitespace-normal"
              disabled={writing.has(draft.id)}
              onClick={() => onChoose(draft.id)}
            >
              <span className="min-w-0 truncate">{draft.title}</span>
              <span className="text-[13px] text-ink-soft">
                {writing.has(draft.id) ? 'being written' : `v${draft.version}`}
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fieldset>
  )
}
