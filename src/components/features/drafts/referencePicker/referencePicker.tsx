// New Draft: tick other written Drafts the Assistant may read as References.
import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { cn } from '@/lib/cn'

interface ReferencePickerProps {
  /** The Project's written Drafts. */
  referable: DraftSummary[]
  references: string[]
  onToggle: (draftId: string) => void
}

export function ReferencePicker({ referable, references, onToggle }: Readonly<ReferencePickerProps>) {
  const assistant = useAssistantLabel()
  return (
    <fieldset className="mt-6">
      <FieldLabel hint={`${assistant} may read these Drafts as context. No hierarchy — each Draft stands on its own.`}>
        References (optional)
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {referable.map((draft) => {
          const on = references.includes(draft.id)
          return (
            <label
              key={draft.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                on ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
              )}
            >
              <input type="checkbox" className="accent-claude" checked={on} onChange={() => onToggle(draft.id)} />
              <span className="text-ink-faint">{draft.workItemType}</span> {draft.title}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
