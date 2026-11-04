// Whether Discarded Sections and Entries show on the Draft sheet: one Draft-wide setting, which each Section
// can override for its own Entries. The value comes from useDiscardedVisibilityValue.
import { createContext, useContext } from 'react'

export interface DiscardedVisibilityValue {
  /** The Draft-wide setting: Discarded Sections, and the Entries of Sections without an override. */
  showAll: boolean
  /** Sets the Draft-wide setting and clears every Section's override. */
  setShowAll: (show: boolean) => void
  /** Whether this Section's Discarded Entries show: its own override, else the Draft-wide setting. */
  showsInSection: (sectionId: string) => boolean
  setShowsInSection: (sectionId: string, show: boolean) => void
}

export const DiscardedVisibilityContext = createContext<DiscardedVisibilityValue | null>(null)

export function useDiscardedVisibility() {
  const value = useContext(DiscardedVisibilityContext)
  if (!value) throw new Error('useDiscardedVisibility outside DiscardedVisibilityContext')
  return value
}
