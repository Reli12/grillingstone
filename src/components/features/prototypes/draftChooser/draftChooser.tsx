// The optional Draft of a Prototype, on the New Prototype form: only Drafts at v1 or later are offered, since an
// earlier one has nothing to illustrate. A Draft that already has a Prototype being written can't be picked.
import { useId } from 'react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { fieldClass } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'

interface DraftChooserProps {
  drafts: DraftSummary[]
  /** Ids of the Drafts a Prototype is being written for. */
  writing: ReadonlySet<string>
  /** The id of the chosen Draft; '' for none. */
  value: string
  onChange: (draftId: string) => void
}

/** The optional Draft of a Prototype: at most one, at v1 or later. */
export function DraftChooser({ drafts, writing, value, onChange }: Readonly<DraftChooserProps>) {
  const id = useId()
  const offered = drafts.filter((draft) => draft.version >= 1)
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        Draft (optional)
      </label>
      <p className="text-[13px] text-ink-soft">
        {offered.length === 0
          ? 'No Draft has reached v1 yet. A Draft needs to be at v1 or later to be picked here.'
          : 'The Prototype is labelled with the Draft, and its Images are offered below. Write now needs one.'}
      </p>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClass, 'mt-1 h-9 text-sm')}
      >
        <option value="">No Draft</option>
        {offered.map((draft) => {
          const busy = writing.has(draft.id)
          const state = busy ? 'being written' : `v${draft.version}`
          return (
            <option key={draft.id} value={draft.id} disabled={busy && draft.id !== value}>
              {`${draft.title} · ${state}`}
            </option>
          )
        })}
      </select>
    </div>
  )
}
