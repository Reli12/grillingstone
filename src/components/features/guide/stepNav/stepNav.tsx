// How it works: the sticky list of steps that links to each one.
import { STEPS } from '@/constants/GuideConstants'

export function StepNav() {
  return (
    <nav className="hidden lg:block" aria-label="Steps">
      <ol className="sticky top-8 space-y-1.5 text-sm">
        {STEPS.map((step, i) => (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              className="flex gap-2.5 rounded px-2 py-1 text-ink-soft hover:bg-fog-deep hover:text-ink"
            >
              <span className="w-3 text-ink-faint tabular-nums">{i + 1}</span>
              {step.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
