// The References dialog's table: tick a row to reference it, untick to drop it. Unsaved changes are marked on their
// rows (Added, Removed, Parent). Backlog Copies carry the Parent toggle.
import type { MouseEvent } from 'react'

import { Crown } from 'lucide-react'

import type { ReferenceTab } from '@/hooks/draft/useReferenceFilters'
import {
  type ReferenceChange,
  type ReferenceItem,
  referenceName,
  type ReferenceSelection,
} from '@/hooks/draft/useReferenceSelection'
import { cn } from '@/lib/cn'

const CHANGES: Record<ReferenceChange, { label: string; badge: string; edge: string }> = {
  added: {
    label: 'Added',
    badge: 'bg-proof/15 text-proof',
    edge: 'shadow-[inset_3px_0_0_var(--color-proof)]',
  },
  removed: {
    label: 'Removed',
    badge: 'bg-redpencil/15 text-redpencil',
    edge: 'shadow-[inset_3px_0_0_var(--color-redpencil)]',
  },
  parent: {
    label: 'Parent',
    badge: 'bg-claude/15 text-claude',
    edge: 'shadow-[inset_3px_0_0_var(--color-claude)]',
  },
}

/** What the Kind / Lane column says. */
function kindOf(item: ReferenceItem): string {
  if (item.kind === 'backlog') return 'Azure DevOps'
  return item.archived ? 'Archived' : (item.lane ?? '')
}

function ParentToggle({ selection, item }: Readonly<{ selection: ReferenceSelection; item: ReferenceItem }>) {
  const on = selection.parent === item.id
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Parent: ${referenceName(item)}`}
      title={on ? 'The Parent: Publish places the work item under it' : 'Make it the Parent'}
      onClick={() => selection.toggleParent(item)}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px]',
        on ? 'bg-claude font-medium text-on-accent' : 'border border-line text-ink-soft hover:border-ink-faint',
      )}
    >
      <Crown size={12} /> Parent
    </button>
  )
}

function Row({
  selection,
  item,
  withParent,
}: Readonly<{ selection: ReferenceSelection; item: ReferenceItem; withParent: boolean }>) {
  const change = selection.changeOf(item)
  const selected = selection.isSelected(item)
  // A click anywhere on the row ticks it; the checkbox and the Parent toggle handle their own clicks.
  const onRowClick = (event: MouseEvent) => {
    if (!(event.target as HTMLElement).closest('input, button, a')) selection.toggle(item)
  }
  return (
    <tr
      onClick={onRowClick}
      className={cn('cursor-pointer hover:bg-fog', selected && 'bg-claude-wash/60', change && CHANGES[change].edge)}
    >
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          className="accent-claude"
          aria-label={referenceName(item)}
          checked={selected}
          onChange={() => selection.toggle(item)}
        />
      </td>
      <td className="py-1.5">
        <span className="inline-block w-16 rounded bg-fog px-1.5 py-0.5 text-center text-[11px] text-ink-soft">
          {item.type}
        </span>
      </td>
      <td
        className={cn('max-w-0 truncate py-1.5 pr-3', change === 'removed' && 'text-ink-faint line-through')}
        title={item.title}
      >
        {item.workItemId && <span className="mr-1 text-ink-faint">#{item.workItemId}</span>}
        {item.title}
      </td>
      <td className="hidden py-1.5 text-[12px] text-ink-faint sm:table-cell">{kindOf(item)}</td>
      {withParent && (
        <td className="py-1.5">{item.kind === 'backlog' && <ParentToggle selection={selection} item={item} />}</td>
      )}
      <td className="py-1.5 pr-3 text-[12px]">
        {change && <span className={cn('rounded px-1.5 py-0.5', CHANGES[change].badge)}>{CHANGES[change].label}</span>}
      </td>
    </tr>
  )
}

interface ReferencesTableProps {
  selection: ReferenceSelection
  rows: ReferenceItem[]
  tab: ReferenceTab
  /** Whether the Project has Backlog Copies at all (Azure DevOps). */
  withBacklog: boolean
  empty: string
}

export function ReferencesTable({ selection, rows, tab, withBacklog, empty }: Readonly<ReferencesTableProps>) {
  const withParent = withBacklog && tab !== 'draft'
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-line">
      <table className="w-full table-fixed text-sm">
        <thead className="sticky top-0 z-10 bg-fog text-left text-[12px] text-ink-faint">
          <tr>
            <th className="w-10 px-3 py-2">
              <span className="sr-only">In use</span>
            </th>
            <th className="w-20 py-2">Type</th>
            <th className="py-2">Title</th>
            <th className="hidden w-28 py-2 sm:table-cell">{tab === 'draft' ? 'Lane' : 'Kind'}</th>
            {withParent && <th className="w-24 py-2">Parent</th>}
            <th className="w-24 py-2 pr-3">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((item) => (
            <Row key={item.id} selection={selection} item={item} withParent={withParent} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="px-3 py-4 text-sm text-ink-faint">{empty}</p>}
    </div>
  )
}
