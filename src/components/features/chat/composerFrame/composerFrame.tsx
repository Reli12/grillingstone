// The bar pinned under the chat, holding the bordered message box.
import { type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface ComposerFrameProps {
  /** Highlights the border while the box can be typed in. */
  active: boolean
  children: ReactNode
}

/** The bar pinned under the chat, holding the bordered message box. */
export function ComposerFrame({ active, children }: Readonly<ComposerFrameProps>) {
  return (
    <div className="shrink-0 border-t border-line bg-sheet">
      <div className="mx-auto max-w-[720px] px-4 py-3">
        <div
          className={cn(
            'rounded-lg border bg-sheet transition-colors',
            active ? 'border-line focus-within:border-claude' : 'border-line-soft',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
