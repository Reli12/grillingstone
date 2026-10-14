// The box that narrows the Glossary list to terms whose name, definition or words to avoid contain the text.
import { Search } from 'lucide-react'

import { TextInput } from '@/components/atoms/textInput/textInput'

interface GlossaryFilterProps {
  value: string
  onChange: (value: string) => void
  /** Off while the whole markdown is being edited. */
  disabled: boolean
}

export function GlossaryFilter({ value, onChange, disabled }: Readonly<GlossaryFilterProps>) {
  return (
    <div className="relative min-w-48 flex-1">
      <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
      <TextInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Filter by term, definition or alias"
        aria-label="Filter terms"
        className="pl-8 disabled:opacity-60"
      />
    </div>
  )
}
