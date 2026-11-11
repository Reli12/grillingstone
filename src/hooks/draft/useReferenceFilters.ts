// The References dialog's filters for the tab shown: text (title, type or #ID), Work Item Type, Active / Archived
// Drafts, and what is in use first.
import { useState } from 'react'

import type { ReferenceItem, ReferenceSelection } from '@/hooks/draft/useReferenceSelection'

/** Drafts, Backlog Copies, or everything in use (and what is about to be removed, so it can be put back). */
export type ReferenceTab = 'draft' | 'backlog' | 'inUse'
export type DraftState = 'active' | 'archived' | 'all'

/** Every word typed must appear in the type, the #ID or the title. */
export function matchesQuery(item: ReferenceItem, query: string): boolean {
  const text = `${item.type} ${item.workItemId ?? ''} ${item.title}`.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word.replace(/^#/, '')))
}

export function useReferenceFilters(selection: ReferenceSelection, tab: ReferenceTab) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [state, setState] = useState<DraftState>('active')
  const [inUseFirst, setInUseFirst] = useState(true)
  const pool = selection.items.filter((item) =>
    tab === 'inUse' ? selection.isSelected(item) || selection.changeOf(item) === 'removed' : item.kind === tab,
  )
  const types = [...new Set(pool.map((item) => item.type))].sort((first, second) => first.localeCompare(second))
  const shownType = types.includes(type) ? type : 'all'
  const rows = pool
    .filter((item) => (shownType === 'all' || item.type === shownType) && matchesQuery(item, query))
    .filter((item) => item.kind !== 'draft' || state === 'all' || (state === 'archived') === item.archived)
    .sort((first, second) =>
      inUseFirst ? Number(selection.isSelected(second)) - Number(selection.isSelected(first)) : 0,
    )
  // Archived Drafts the Active view leaves out that would otherwise show, so an empty table can say so.
  const hiddenArchived =
    tab === 'draft' && state === 'active'
      ? pool.filter(
          (item) => item.archived && (shownType === 'all' || item.type === shownType) && matchesQuery(item, query),
        ).length
      : 0
  return {
    rows,
    total: pool.length,
    hiddenArchived,
    query,
    setQuery,
    types,
    type: shownType,
    setType,
    state,
    setState,
    inUseFirst,
    setInUseFirst,
  }
}

export type ReferenceFilters = ReturnType<typeof useReferenceFilters>
