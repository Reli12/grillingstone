// The dashed placeholder a list shows when it has nothing in it yet, with an optional action.
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, children, action }: Readonly<EmptyStateProps>) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
