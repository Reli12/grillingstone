// A work item named by its ID or link in the Publish dialog (the parent, or the existing item to update). What is
// typed is applied on Enter, on leaving the field or with Check, and only when it changed.
import { type ReactNode, useId, useState } from 'react'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'

interface WorkItemFieldProps {
  label: ReactNode
  hint: ReactNode
  /** What the field holds now, as the plan was made with it. */
  current: string
  /** The plan for a new value is loading. */
  checking: boolean
  onApply: (value: string) => void
  /** The item found, e.g. "Feature #100 · Device archiving". */
  found?: string | null
}

export function WorkItemField({ label, hint, current, checking, onApply, found }: Readonly<WorkItemFieldProps>) {
  const id = useId()
  const [text, setText] = useState(current)
  const apply = () => text.trim() !== current && onApply(text.trim())
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <p className="text-[13px] text-ink-faint">{hint}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <TextInput
          id={id}
          className="flex-1"
          value={text}
          placeholder="e.g. 1234 or https://dev.azure.com/…/_workitems/edit/1234"
          onChange={(event) => setText(event.target.value)}
          onBlur={apply}
          onKeyDown={(event) => event.key === 'Enter' && apply()}
        />
        <Button variant="quiet" onClick={apply} disabled={checking}>
          {checking ? <Loader2 size={15} className="animate-spin" /> : 'Check'}
        </Button>
      </div>
      {found && <p className="mt-1 text-[13px] text-ink-soft">{found}</p>}
    </div>
  )
}
