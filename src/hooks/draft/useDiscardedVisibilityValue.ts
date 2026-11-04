// What DiscardedVisibilityContext holds. Kept in memory for this page only; Discarded parts show by default.
import { useMemo, useState } from 'react'

import type { DiscardedVisibilityValue } from '@/context/DiscardedVisibility/DiscardedVisibility'

export function useDiscardedVisibilityValue(): DiscardedVisibilityValue {
  const [showAll, setShowAllState] = useState(true)
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map())

  return useMemo(
    () => ({
      showAll,
      setShowAll: (show: boolean) => {
        setShowAllState(show)
        setOverrides(new Map())
      },
      showsInSection: (sectionId: string) => overrides.get(sectionId) ?? showAll,
      setShowsInSection: (sectionId: string, show: boolean) =>
        setOverrides((current) => new Map(current).set(sectionId, show)),
    }),
    [showAll, overrides],
  )
}
