// "Copy for Jira": one switch for how every field is pasted — rich text or Jira wiki markup.
import { cn } from '@/lib/cn'
import type { PasteFormat } from '@/types/publish'

const FORMATS: { value: PasteFormat; label: string; hint: string }[] = [
  { value: 'rich', label: 'Rich text', hint: 'Jira Cloud, or Data Center in Visual mode' },
  { value: 'wiki', label: 'Wiki markup', hint: 'Jira Data Center in Text mode' },
]

interface PasteFormatSwitchProps {
  value: PasteFormat
  onChange: (format: PasteFormat) => void
}

export function PasteFormatSwitch({ value, onChange }: Readonly<PasteFormatSwitchProps>) {
  return (
    <div role="radiogroup" aria-label="Paste format" className="grid grid-cols-2 gap-1 rounded-lg bg-fog-deep p-1">
      {FORMATS.map((format) => (
        <button
          key={format.value}
          type="button"
          role="radio"
          aria-checked={value === format.value}
          onClick={() => onChange(format.value)}
          className={cn(
            'rounded-md px-3 py-2 text-left',
            value === format.value ? 'bg-sheet shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
        >
          <span className="block text-sm font-semibold">{format.label}</span>
          <span className="block text-[12px] text-ink-faint">{format.hint}</span>
        </button>
      ))}
    </div>
  )
}
