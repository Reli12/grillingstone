// The Default Tracker setting: which Tracker the New Project dialog preselects. Saved at once, like the theme.
import type { Settings } from '#core/contract/apiTypes.ts'

import { useSaveSettings } from '@/api/hooks/projects/projectHooks'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TrackerSwitch } from '@/components/features/trackers/trackerSwitch/trackerSwitch'

interface DefaultTrackerChoiceProps {
  settings: Settings
}

export function DefaultTrackerChoice({ settings }: Readonly<DefaultTrackerChoiceProps>) {
  const save = useSaveSettings()
  return (
    <fieldset>
      <FieldLabel hint="Preselected when you create a Project. Existing Projects keep their own Tracker.">
        Default Tracker
      </FieldLabel>
      <TrackerSwitch
        label="Default Tracker"
        value={settings.defaultTracker}
        onChange={(defaultTracker) => save.mutate({ ...settings, defaultTracker })}
      />
    </fieldset>
  )
}
