// A titled section of running text, labelled by its heading so assistive tech reads it as a region.
import type { ReactNode } from 'react'

interface ProseSectionProps {
  /** Ties the section to its heading; must be unique on the page. */
  id: string
  title: string
  children: ReactNode
}

/** A heading and its paragraphs or lists, spaced evenly, with bold text in the darker ink. */
export function ProseSection({ id, title, children }: Readonly<ProseSectionProps>) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-serif text-xl font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-2 space-y-3 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
    </section>
  )
}
