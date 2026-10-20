// One numbered step of a walkthrough, with an anchor id so it can be linked to.
import type { ReactNode } from 'react'

interface NumberedStepProps {
  n: number
  id: string
  title: string
  children: ReactNode
}

/** A numbered, anchor-linkable step of a walkthrough. */
export function NumberedStep({ n: stepNumber, id, title, children }: Readonly<NumberedStepProps>) {
  const titleId = `${id}-title`
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="scroll-mt-6 border-t border-line pt-10 first:border-t-0 first:pt-0"
    >
      <div className="flex items-baseline gap-4">
        <span className="font-serif text-[40px] leading-none font-semibold text-claude/70 tabular-nums" aria-hidden>
          {stepNumber}
        </span>
        <h2 id={titleId} className="font-serif text-[24px] leading-tight font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </section>
  )
}
