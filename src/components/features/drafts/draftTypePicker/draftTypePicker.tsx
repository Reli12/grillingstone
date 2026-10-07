// New Draft: choose the Work Item Type, each with its one-line hint.
import { WORK_ITEM_TYPE_HINTS, WORK_ITEM_TYPES, type WorkItemType } from '#core/shared/workItemType.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { cn } from '@/lib/cn'

interface DraftTypePickerProps {
  type: WorkItemType
  onChoose: (type: WorkItemType) => void
}

export function DraftTypePicker({ type, onChoose }: Readonly<DraftTypePickerProps>) {
  return (
    <fieldset>
      <FieldLabel>Work Item Type</FieldLabel>
      <div className="grid grid-cols-5 rounded-lg bg-fog-deep p-1" role="radiogroup">
        {WORK_ITEM_TYPES.map((option) => (
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
      <p className="mt-2 text-[13px] text-ink-faint">{WORK_ITEM_TYPE_HINTS[type]}</p>
    </fieldset>
  )
}
