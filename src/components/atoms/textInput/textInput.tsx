import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

/** Shared look of text fields; TextArea uses it too. */
export const fieldClass =
  'w-full rounded-md border border-line bg-sheet px-3 text-ink placeholder:text-ink-faint focus:border-claude focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-claude/15'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldClass, 'h-9 text-sm', className)} {...rest} />
})
