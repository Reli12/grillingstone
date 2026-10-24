// Templates page: whose Templates are listed — the Default Tracker from Settings until the human picks one.
import { useState } from 'react'

import type { Tracker } from '#core/shared/tracker.ts'

import { useSettings } from '@/api/hooks/projects/projectHooks'

/** `tracker` is undefined while Settings load. */
export function useShownTracker() {
  const [picked, setPicked] = useState<Tracker | null>(null)
  const defaultTracker = useSettings().data?.defaultTracker
  return { tracker: picked ?? defaultTracker, showTracker: setPicked }
}
