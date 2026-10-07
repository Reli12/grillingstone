// The Draft's Iteration Log: one dated line per version.
import type { IterationLogLine } from '#core/draft/draftTypes.ts'
import { formatLogDate } from '#core/publish/publishRenderer.ts'

export function IterationLog({ heading, log }: Readonly<{ heading: string; log: IterationLogLine[] }>) {
  return (
    <section className="mt-10 border-t border-line-soft pt-5 pl-8" aria-label={heading}>
      <h2 className="font-serif text-[17px] font-semibold text-ink">{heading}</h2>
      <ol className="mt-2 space-y-1 font-serif text-[14px] text-ink-soft">
        {log.map((line) => (
          <li key={line.version}>
            <span className="text-ink">
              {formatLogDate(line.date)} - @{line.author} v{line.version}
            </span>{' '}
            <span className="text-ink-faint">{line.note}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
