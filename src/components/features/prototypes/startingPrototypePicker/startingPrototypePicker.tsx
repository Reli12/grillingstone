// The optional starting point of a Prototype: any earlier Prototype of the Project, none chosen until the human does.
import { useId } from 'react'

import type { Prototype } from '#core/prototype/prototypeRecords.ts'

import { fieldClass } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'
import { prototypeLabel } from '@/lib/prototypeLabel'

interface StartingPrototypePickerProps {
  /** The Project's earlier Prototypes, newest first. */
  earlier: Prototype[]
  /** The id of the chosen Prototype; '' for none. */
  value: string
  onChange: (prototypeId: string) => void
}

/** The optional starting point of a Prototype: any earlier Prototype of the Project, none chosen until the human does. */
export function StartingPrototypePicker({ earlier, value, onChange }: Readonly<StartingPrototypePickerProps>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        Start from an earlier Prototype (optional)
      </label>
      <p className="text-[13px] text-ink-soft">Claude keeps its structure and look and updates it to the Draft.</p>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClass, 'mt-1 h-9 text-sm')}
      >
        <option value="">No starting Prototype</option>
        {earlier.map((prototype) => (
          <option key={prototype.id} value={prototype.id}>
            {prototypeLabel(prototype)}
          </option>
        ))}
      </select>
    </div>
  )
}
