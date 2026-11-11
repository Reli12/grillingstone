// The Project board's filters: search, Needs you, Work Item Types, Templates and how recently a Draft changed.
// The board always opens on Drafts updated in the last week; Reset goes back to that, not to everything.
import { useState } from 'react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

import { DEFAULT_UPDATED_WINDOW, type UpdatedWindow } from '@/constants/DraftBoardConstants'
import { DAY_MS, needsYou } from '@/lib/draftSummary'

export interface DraftFilterValues {
  query: string
  needsOnly: boolean
  types: WorkItemType[]
  templates: string[]
  updatedWithin: UpdatedWindow
}

export const DEFAULT_DRAFT_FILTERS: DraftFilterValues = {
  query: '',
  needsOnly: false,
  types: [],
  templates: [],
  updatedWithin: DEFAULT_UPDATED_WINDOW,
}

/** Whether `draft` passes every filter; empty Type and Template lists mean any. */
export function draftMatches(draft: DraftSummary, filters: DraftFilterValues, now = Date.now()) {
  const query = filters.query.trim().toLowerCase()
  return (
    (!query || `${draft.title} ${draft.requirement}`.toLowerCase().includes(query)) &&
    (!filters.needsOnly || needsYou(draft)) &&
    (!filters.types.length || filters.types.includes(draft.workItemType)) &&
    (!filters.templates.length || filters.templates.includes(draft.templateName)) &&
    (filters.updatedWithin === 0 || now - new Date(draft.updatedAt).getTime() < filters.updatedWithin * DAY_MS)
  )
}

const toggled = <T>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

export function useDraftFilters() {
  const [filters, setFilters] = useState(DEFAULT_DRAFT_FILTERS)
  const set = (patch: Partial<DraftFilterValues>) => setFilters((current) => ({ ...current, ...patch }))
  return {
    filters,
    setQuery: (query: string) => set({ query }),
    setNeedsOnly: (needsOnly: boolean) => set({ needsOnly }),
    setUpdatedWithin: (updatedWithin: UpdatedWindow) => set({ updatedWithin }),
    toggleType: (type: WorkItemType) => setFilters((current) => ({ ...current, types: toggled(current.types, type) })),
    toggleTemplate: (name: string) =>
      setFilters((current) => ({ ...current, templates: toggled(current.templates, name) })),
    /** Anything changed from how the board opens. */
    changed: JSON.stringify(filters) !== JSON.stringify(DEFAULT_DRAFT_FILTERS),
    reset: () => setFilters(DEFAULT_DRAFT_FILTERS),
    matches: (draft: DraftSummary) => draftMatches(draft, filters),
  }
}

export type DraftFilters = ReturnType<typeof useDraftFilters>
