// The text as it reads on the sheet; a click, or Enter while focused, starts editing.
import { type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface ReadingViewProps {
  disabled?: boolean
  className?: string
  onStart: () => void
  children: ReactNode
}

/** The text as it reads on the sheet; a click, or Enter while focused, starts editing. */
export function ReadingView({ disabled, className, onStart, children }: Readonly<ReadingViewProps>) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={onStart}
      // Only Enter on this element itself: Enter inside a link or nested control keeps its own meaning.
      onKeyDown={(event) => event.key === 'Enter' && event.target === event.currentTarget && onStart()}
      className={cn('-mx-2 rounded px-2 py-0.5', !disabled && 'cursor-text hover:bg-mark-wash/70', className)}
      title={disabled ? undefined : 'Click to edit'}
    >
      {children}
    </div>
  )
}
