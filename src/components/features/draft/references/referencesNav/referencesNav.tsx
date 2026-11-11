// The References dialog's tabs: Drafts, Backlog Copies (Azure DevOps Projects only) and In use, each with how many
// are in use. A column beside the table on wide screens, a row above it on narrow ones.
import type { ReactNode } from 'react'

import type { ReferenceTab } from '@/hooks/draft/useReferenceFilters'
import type { ReferenceSelection } from '@/hooks/draft/useReferenceSelection'
import { cn } from '@/lib/cn'

interface ReferencesNavProps {
  selection: ReferenceSelection
  tab: ReferenceTab
  onTab: (tab: ReferenceTab) => void
  withBacklog: boolean
}

const HINTS: Record<ReferenceTab, string> = {
  draft: 'Other Drafts later sessions may read in full as context. No hierarchy — each Draft stands on its own.',
  backlog:
    'Azure DevOps work items this Draft derives from. Later sessions get them listed and read one when it matters. Mark one as the Parent: Publish places the work item under it.',
  inUse: 'Everything this Draft references. A change applies from the next session.',
}

export function ReferencesNav({ selection, tab, onTab, withBacklog }: Readonly<ReferencesNavProps>) {
  const count = (kind: 'draft' | 'backlog') => {
    const ofKind = selection.items.filter((item) => item.kind === kind)
    return `${ofKind.filter(selection.isSelected).length} of ${ofKind.length} in use`
  }
  const inUse = selection.items.filter(selection.isSelected).length
  const button = (key: ReferenceTab, label: string, note: ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => onTab(key)}
      className={cn(
        'flex shrink-0 flex-col items-start rounded-md px-3 py-2 text-left text-sm md:w-full',
        tab === key ? 'bg-claude-wash font-medium text-ink' : 'text-ink-soft hover:bg-fog',
      )}
    >
      {label}
      <span className="text-[12px] font-normal text-ink-faint">{note}</span>
    </button>
  )
  return (
    <nav className="flex shrink-0 flex-col gap-2 md:w-52 md:border-r md:border-line-soft md:pr-3">
      <div role="tablist" aria-label="References" className="flex gap-1 overflow-x-auto md:flex-col">
        {button('draft', 'Drafts', count('draft'))}
        {withBacklog && button('backlog', 'Backlog Copies', count('backlog'))}
        {button('inUse', 'In use', `${inUse} total`)}
      </div>
      <p className="hidden px-3 pt-2 text-[12px] leading-4 text-ink-faint md:block">{HINTS[tab]}</p>
    </nav>
  )
}
