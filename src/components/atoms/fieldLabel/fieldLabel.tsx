// A form field's label, with an optional quieter hint line under it.
import type { ReactNode } from 'react'

interface FieldLabelProps {
  children: ReactNode
  htmlFor?: string
  hint?: ReactNode
}

export function FieldLabel({ children, htmlFor, hint }: Readonly<FieldLabelProps>) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block">
      <span className="text-sm font-semibold text-ink">{children}</span>
      {hint && <span className="mt-0.5 block text-[13px] text-ink-faint">{hint}</span>}
    </label>
  )
}
