// The Project board's sidebar: Board or Archived, then the filters with how many Drafts each would show.
// It opens on the last week (DEFAULT_UPDATED_WINDOW); Reset goes back to that.
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { BookOpen, Search } from 'lucide-react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { fieldClass } from '@/components/atoms/textInput/textInput'
import { DEFAULT_UPDATED_WINDOW, UPDATED_WINDOWS } from '@/constants/DraftBoardConstants'
import type { DraftFilters as Filters } from '@/hooks/drafts/useDraftFilters'
import { cn } from '@/lib/cn'
import { needsYou } from '@/lib/draftSummary'
import { routesPaths } from '@/routes/routes'

export type DraftsView = 'board' | 'archived'

interface DraftFiltersProps {
  projectId: string
  filters: Filters
  /** The Drafts of the current view, before filtering: what the counts count. */
  pool: DraftSummary[]
  view: DraftsView
  onView: (view: DraftsView) => void
  openCount: number
  archivedCount: number
}

function Group({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <fieldset>
      <legend className="mb-1 text-[12px] font-semibold tracking-wide text-ink-faint uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}

interface CheckRowProps {
  checked: boolean
  label: ReactNode
  count: number
  onChange: () => void
}

function CheckRow({ checked, label, count, onChange }: Readonly<CheckRowProps>) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-ink-faint">{count}</span>
    </label>
  )
}

const viewTab = (selected: boolean) => cn('flex-1 py-1.5', selected && 'bg-fog-deep font-medium')
const distinct = <T,>(values: T[]) => [...new Set(values)]

type ViewTabsProps = Pick<DraftFiltersProps, 'view' | 'onView' | 'openCount' | 'archivedCount'>

function ViewTabs({ view, onView, openCount, archivedCount }: Readonly<ViewTabsProps>) {
  const tabs: [DraftsView, string][] = [
    ['board', `Board ${openCount}`],
    ['archived', `Archived ${archivedCount}`],
  ]
  return (
    <div role="tablist" aria-label="Drafts view" className="flex rounded-md border border-line text-[13px]">
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={view === tab}
          className={viewTab(view === tab)}
          onClick={() => onView(tab)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function UpdatedWindows({ filters }: Readonly<{ filters: Filters }>) {
  return (
    <Group title="Updated">
      {UPDATED_WINDOWS.map((days) => (
        <label key={days} className="flex items-center gap-2 py-0.5 text-[13px]">
          <input
            type="radio"
            name="updated-within"
            checked={filters.filters.updatedWithin === days}
            onChange={() => filters.setUpdatedWithin(days)}
          />
          {days === 0 ? 'Any time' : `Last ${days} days`}
          {days === DEFAULT_UPDATED_WINDOW && <span className="text-[11px] text-ink-faint">default</span>}
        </label>
      ))}
    </Group>
  )
}

interface ValueGroupProps<T extends string> {
  title: string
  /** Each Draft's value for this filter; the options are the distinct ones. */
  values: T[]
  selected: T[]
  onToggle: (value: T) => void
}

function ValueGroup<T extends string>({ title, values, selected, onToggle }: Readonly<ValueGroupProps<T>>) {
  return (
    <Group title={title}>
      {distinct(values).map((value) => (
        <CheckRow
          key={value}
          checked={selected.includes(value)}
          label={value}
          count={values.filter((item) => item === value).length}
          onChange={() => onToggle(value)}
        />
      ))}
    </Group>
  )
}

export function DraftFilters({ projectId, filters, pool, ...views }: Readonly<DraftFiltersProps>) {
  const { filters: values } = filters
  return (
    <aside className="space-y-4 overflow-y-auto pr-1" aria-label="Filter Drafts">
      <ViewTabs {...views} />
      <label className={cn(fieldClass, 'flex h-8 items-center gap-2 px-2')}>
        <Search size={14} className="text-ink-faint" />
        <input
          type="search"
          aria-label="Search Drafts"
          placeholder="Search Drafts…"
          value={values.query}
          onChange={(event) => filters.setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <CheckRow
        checked={values.needsOnly}
        label={<span className="font-medium text-redpencil">Needs you</span>}
        count={pool.filter(needsYou).length}
        onChange={() => filters.setNeedsOnly(!values.needsOnly)}
      />
      <UpdatedWindows filters={filters} />
      <ValueGroup
        title="Type"
        values={pool.map((draft) => draft.workItemType)}
        selected={values.types}
        onToggle={filters.toggleType}
      />
      <ValueGroup
        title="Template"
        values={pool.map((draft) => draft.templateName)}
        selected={values.templates}
        onToggle={filters.toggleTemplate}
      />
      {filters.changed && (
        <button type="button" className="text-[13px] text-ink-soft underline hover:text-ink" onClick={filters.reset}>
          Reset filters
        </button>
      )}
      <Link
        to={routesPaths.projectGlossary(projectId)}
        className="flex items-center gap-1.5 border-t border-line-soft pt-3 text-[13px] text-ink-soft hover:text-ink"
      >
        <BookOpen size={14} /> Open Glossary
      </Link>
    </aside>
  )
}
