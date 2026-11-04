// Shows or hides Discarded parts: Draft-wide in the toolbar, or one Section's Entries in its heading.
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'

interface DiscardedToggleProps {
  /** Whether the Discarded parts show now. */
  shown: boolean
  /** How many Discarded parts the toggle covers; it renders nothing when there are none. */
  count: number
  onChange: (shown: boolean) => void
  /** What the toggle covers, for its tooltip: "in this Draft" or "in this Section". */
  scope: string
}

export function DiscardedToggle({ shown, count, onChange, scope }: Readonly<DiscardedToggleProps>) {
  if (count === 0) return null
  const label = `${shown ? 'Hide' : 'Show'} ${count} discarded`
  return (
    <Button
      size="sm"
      variant="quiet"
      onClick={() => onChange(!shown)}
      title={`${shown ? 'Hide' : 'Show'} the Discarded parts ${scope}. Parts with a pending change always show.`}
      className="text-ink-faint"
    >
      {shown ? <EyeOff size={14} /> : <Eye size={14} />} {label}
    </Button>
  )
}
