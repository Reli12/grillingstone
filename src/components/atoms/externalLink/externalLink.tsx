// A link to a page outside the tool, opened in a new tab so the app keeps its place.
import type { ReactNode } from 'react'

import { ExternalLink as ExternalLinkIcon } from 'lucide-react'

interface ExternalLinkProps {
  href: string
  children: ReactNode
}

/** Opens in a new tab without handing the outside page a reference back to this one (noreferrer). */
export function ExternalLink({ href, children }: Readonly<ExternalLinkProps>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-claude underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLinkIcon size={13} aria-hidden />
    </a>
  )
}
