// Inline code inside running text: a command, a file or a folder name.
import type { ReactNode } from 'react'

/** Its fog-deep chip is darker than both the page (fog) and card (sheet) backgrounds, so it shows on either. */
export function InlineCode({ children }: Readonly<{ children: ReactNode }>) {
  return <code className="rounded bg-fog-deep px-1">{children}</code>
}
