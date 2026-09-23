import { cn } from '@/lib/cn'

/** Three dots that pulse in turn — Claude is working. */
interface ThinkingProps {
  className?: string
  label?: string
}

export function Thinking({ className, label = 'Claude is thinking' }: ThinkingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-claude', className)} role="status">
      <span className="inline-flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-pulse rounded-full bg-claude" style={{ animationDelay: `${i * 180}ms` }} />
        ))}
      </span>
      {label}
    </span>
  )
}
