// New Template: choose the Tracker and the Work Item Type the Template is for.
import type { Tracker } from '#core/shared/tracker.ts'
import { type WorkItemType, workItemTypes } from '#core/shared/workItemType.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TrackerSwitch } from '@/components/features/trackers/trackerSwitch/trackerSwitch'
import { cn } from '@/lib/cn'

interface TemplateTypePickerProps {
  tracker: Tracker
  type: WorkItemType
  onChooseTracker: (tracker: Tracker) => void
  onChoose: (type: WorkItemType) => void
}

export function TemplateTypePicker({ tracker, type, onChooseTracker, onChoose }: Readonly<TemplateTypePickerProps>) {
  return (
    <fieldset className="space-y-3">
      <div>
        <FieldLabel hint="A Template is written for one Tracker's fields.">Tracker</FieldLabel>
        <TrackerSwitch value={tracker} onChange={onChooseTracker} />
      </div>
      <FieldLabel>Work Item Type</FieldLabel>
      <div className="grid grid-cols-3 rounded-lg bg-fog-deep p-1" role="radiogroup">
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
    </fieldset>
  )
}
