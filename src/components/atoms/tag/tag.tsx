import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'claude' | 'mark' | 'redpencil' | 'proof' | 'ink'
const tones: Record<Tone, string> = {
  neutral: 'bg-fog-deep text-ink-soft',
  claude: 'bg-claude-wash text-claude',
  mark: 'bg-mark-wash text-mark-ink',
  redpencil: 'bg-redpencil-wash text-redpencil',
  proof: 'bg-proof-wash text-proof',
  ink: 'bg-ink text-on-ink',
}

interface TagProps {
  tone?: Tone
  children: ReactNode
  className?: string
  title?: string
}

export function Tag({ tone = 'neutral', children, className, title }: TagProps) {
  return (
    <span title={title} className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[12px] leading-none font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}
