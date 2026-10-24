// New Draft: choose one of the Project's Tracker's Work Item Types, each with its one-line hint.
import type { Tracker } from '#core/shared/tracker.ts'
import { type WorkItemType, workItemTypeHint, workItemTypes } from '#core/shared/workItemType.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { cn } from '@/lib/cn'

interface DraftTypePickerProps {
  tracker: Tracker
  type: WorkItemType
  onChoose: (type: WorkItemType) => void
}

export function DraftTypePicker({ tracker, type, onChoose }: Readonly<DraftTypePickerProps>) {
  return (
    <fieldset>
      <FieldLabel>Work Item Type</FieldLabel>
      <div className="grid grid-cols-5 rounded-lg bg-fog-deep p-1" role="radiogroup">
        {workItemTypes(tracker).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            onClick={() => onChoose(option)}
            className={cn(
              'h-8 rounded-md text-sm font-medium',
              type === option ? 'bg-sheet text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-faint">{workItemTypeHint(tracker, type)}</p>
    </fieldset>
  )
}
