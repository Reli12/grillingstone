import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type Variant = 'ink' | 'claude' | 'proof' | 'destructive' | 'outline' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  ink: 'bg-ink text-on-ink hover:bg-ink-soft',
  claude: 'bg-claude text-on-accent hover:bg-claude-strong',
  proof: 'bg-proof text-on-accent hover:bg-proof-strong',
  /** Filled, for a confirmed destructive action (Delete in a confirmation dialog). */
  destructive: 'bg-redpencil text-on-accent hover:bg-redpencil-strong',
  outline: 'border border-line bg-sheet text-ink hover:border-ink-faint',
  quiet: 'text-ink-soft hover:bg-fog-deep hover:text-ink',
  danger: 'text-redpencil hover:bg-redpencil-wash',
}
const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'outline', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}
