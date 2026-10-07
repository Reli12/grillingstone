// The ownership gutter: the margin says who wrote each part. Claude's ink is a thin graphite line; your
// edits are a highlighter stroke; a Section or Entry you moved carries an arrow. These are exactly the
// marks that turn a later change into a Conflict.
import type { HTMLAttributes } from 'react'

import { ArrowUpDown, GripVertical } from 'lucide-react'

import { cn } from '@/lib/cn'

interface GutterProps {
  edited: boolean
  moved: boolean
  pending?: 'clean' | 'conflict'
  handleProps?: HTMLAttributes<HTMLButtonElement>
  size?: 'section' | 'entry'
  group?: 'section' | 'entry'
}

export function Gutter({
  edited,
  moved,
  pending,
  handleProps,
  size = 'section',
  group = 'section',
}: Readonly<GutterProps>) {
  return (
    <div className={cn('relative flex shrink-0 justify-center', size === 'section' ? 'w-7' : 'w-5')}>
      <span
        aria-hidden
        className={cn(
          'absolute top-1 bottom-1 rounded-full',
          edited ? 'w-[5px] bg-mark' : 'w-[2px] bg-claude/45',
          pending === 'conflict' && 'bg-redpencil',
          pending === 'clean' && !edited && 'bg-proof',
        )}
      />
      {handleProps && (
        <button
          {...handleProps}
          className={cn(
            'relative z-10 mt-0.5 flex h-6 w-5 cursor-grab touch-none items-center justify-center rounded bg-sheet text-ink-faint opacity-0 focus-visible:opacity-100 active:cursor-grabbing',
            group === 'entry' ? 'group-hover/entry:opacity-100' : 'group-hover/section:opacity-100',
          )}
          aria-label="Drag to reorder"
        >
          <GripVertical size={15} />
        </button>
      )}
      {moved && (
        <span className="absolute bottom-0 z-10 rounded-full bg-sheet text-ink-soft" title="You moved this">
          <ArrowUpDown size={12} />
        </span>
      )}
    </div>
  )
}
