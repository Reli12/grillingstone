// New Project: the Tracker switch with one hint line naming the Tracker's Work Item Types and the lock rule.
import type { Tracker } from '#core/shared/tracker.ts'
import { workItemTypes } from '#core/shared/workItemType.ts'

import { TrackerSwitch } from '@/components/features/trackers/trackerSwitch/trackerSwitch'

interface TrackerFieldProps {
  value: Tracker
  /** The Default Tracker from Settings, so the hint can say when the pick is it. */
  defaultTracker: Tracker
  onChange: (tracker: Tracker) => void
}

export function TrackerField({ value, defaultTracker, onChange }: Readonly<TrackerFieldProps>) {
  const isDefault = value === defaultTracker ? ' Your default from Settings.' : ''
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Tracker</p>
      <TrackerSwitch value={value} onChange={onChange} />
      <p className="mt-1 text-[12px] text-ink-faint">
        {workItemTypes(value).join(' · ')}.{isDefault} Fixed once the Project has its first Draft.
      </p>
    </div>
  )
}
