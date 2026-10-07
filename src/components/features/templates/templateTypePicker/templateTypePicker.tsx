// New Template: choose the Work Item Type the Template is for.
import { WORK_ITEM_TYPES, type WorkItemType } from '#core/shared/workItemType.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { cn } from '@/lib/cn'

interface TemplateTypePickerProps {
  type: WorkItemType
  onChoose: (type: WorkItemType) => void
}

export function TemplateTypePicker({ type, onChoose }: Readonly<TemplateTypePickerProps>) {
  return (
    <fieldset>
      <FieldLabel>Work Item Type</FieldLabel>
      <div className="grid grid-cols-3 rounded-lg bg-fog-deep p-1" role="radiogroup">
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
    </fieldset>
  )
}
