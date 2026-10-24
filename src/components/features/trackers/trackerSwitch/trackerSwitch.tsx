// A two-way switch between the Trackers (Azure DevOps | Jira), shared by Settings, New Project and the
// Template pages so the choice always looks the same.
import { type Tracker, TRACKER_LABELS, TRACKERS } from '#core/shared/tracker.ts'

import { cn } from '@/lib/cn'

interface TrackerSwitchProps {
  value: Tracker
  onChange: (tracker: Tracker) => void
  /** Read-only, e.g. once a Project has Drafts; the caller explains why. */
  disabled?: boolean
  label?: string
}

export function TrackerSwitch({ value, onChange, disabled = false, label = 'Tracker' }: Readonly<TrackerSwitchProps>) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-fog-deep p-1" role="radiogroup" aria-label={label}>
      {TRACKERS.map((tracker) => {
        const on = value === tracker
        return (
          <button
            key={tracker}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(tracker)}
            className={cn(
              'h-8 rounded-md text-sm font-medium disabled:cursor-not-allowed',
              on ? 'bg-sheet text-ink shadow-sm' : 'text-ink-soft enabled:hover:text-ink',
              disabled && !on && 'opacity-45',
            )}
          >
            {TRACKER_LABELS[tracker]}
          </button>
        )
      })}
    </div>
  )
}
