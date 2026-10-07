// A tab button that marks itself selected; used for small tab strips.
import { type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export function SideTab({
  selected,
  onSelect,
  children,
}: Readonly<{ selected: boolean; onSelect: () => void; children: ReactNode }>) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'h-8 rounded-md px-3 text-sm',
        selected ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
