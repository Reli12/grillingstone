// New Project: one option for how the Glossary starts.
import { type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import type { Source } from '@/types/project'

interface SourceChoiceProps {
  value: Source
  current: Source
  icon: ReactNode
  label: string
  hint: string
  onPick: (source: Source) => void
}

export function SourceChoice({ value, current, icon, label, hint, onPick }: Readonly<SourceChoiceProps>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-2.5 rounded-md border p-2.5',
        current === value ? 'border-claude bg-claude-wash' : 'border-line hover:border-ink-faint',
      )}
    >
      <input
        type="radio"
        checked={current === value}
        onChange={() => onPick(value)}
        className="mt-1 accent-(--color-claude)"
        aria-label={`${label}. ${hint}`}
      />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {label}
        </span>
        <span className="block text-[13px] text-ink-faint">{hint}</span>
      </span>
    </label>
  )
}
