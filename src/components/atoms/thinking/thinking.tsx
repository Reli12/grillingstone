// The pulsing-dots status that says Claude (or a page) is busy.
import { cn } from '@/lib/cn'

const DOTS = [0, 1, 2]
/** Each dot starts its pulse this much after the previous one, so the pulse travels left to right. */
const DOT_STAGGER_MS = 180

/** Three dots that pulse in turn — Claude is working. */
interface ThinkingProps {
  className?: string
  label?: string
}

export function Thinking({ className, label = 'Claude is thinking' }: Readonly<ThinkingProps>) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-claude', className)} role="status">
      <span className="inline-flex gap-1" aria-hidden>
        {DOTS.map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-claude"
            style={{ animationDelay: `${i * DOT_STAGGER_MS}ms` }}
          />
        ))}
      </span>
      {label}
    </span>
  )
}
