import type { ReactNode } from 'react'

interface NumberedStepProps {
  n: number
  id: string
  title: string
  children: ReactNode
}

/** A numbered, anchor-linkable step of a walkthrough. */
export function NumberedStep({ n, id, title, children }: NumberedStepProps) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-4">
        <span className="font-serif text-[40px] leading-none font-semibold text-claude/70 tabular-nums" aria-hidden>
          {n}
        </span>
        <h2 className="font-serif text-[24px] leading-tight font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
    </section>
  )
}
