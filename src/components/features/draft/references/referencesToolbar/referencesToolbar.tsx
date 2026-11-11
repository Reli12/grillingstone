// The References dialog's filters above the table: text, Work Item Type, Active / Archived Drafts, in use first.
import { Search, X } from 'lucide-react'

import type { DraftState, ReferenceFilters, ReferenceTab } from '@/hooks/draft/useReferenceFilters'
import { cn } from '@/lib/cn'

const STATES: [DraftState, string][] = [
  ['active', 'Active'],
  ['archived', 'Archived'],
  ['all', 'All'],
]

export function ReferencesToolbar({ filters, tab }: Readonly<{ filters: ReferenceFilters; tab: ReferenceTab }>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-line bg-sheet px-2.5 focus-within:border-claude">
        <Search size={15} className="shrink-0 text-ink-faint" />
        <input
          aria-label="Filter References"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder="Filter by title, type or #ID"
          value={filters.query}
          onChange={(event) => filters.setQuery(event.target.value)}
        />
        {filters.query && (
          <button
            type="button"
            aria-label="Clear the filter"
            onClick={() => filters.setQuery('')}
            className="text-ink-faint hover:text-ink"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <select
        aria-label="Work Item Type"
        value={filters.type}
        onChange={(event) => filters.setType(event.target.value)}
        className="h-9 rounded-md border border-line bg-sheet px-2 text-sm"
      >
        <option value="all">All types</option>
        {filters.types.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>
      {tab === 'draft' && (
        <div
          role="group"
          aria-label="Drafts shown"
          className="inline-flex rounded-md border border-line p-0.5 text-[13px]"
        >
          {STATES.map(([state, label]) => (
            <button
              type="button"
              key={state}
              aria-pressed={filters.state === state}
              onClick={() => filters.setState(state)}
              className={cn(
                'rounded px-2.5 py-1',
                filters.state === state ? 'bg-fog-deep font-medium' : 'text-ink-soft hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-1.5 text-[13px] text-ink-soft">
        <input
          type="checkbox"
          className="accent-claude"
          checked={filters.inUseFirst}
          onChange={() => filters.setInUseFirst(!filters.inUseFirst)}
        />
        In use first
      </label>
    </div>
  )
}
