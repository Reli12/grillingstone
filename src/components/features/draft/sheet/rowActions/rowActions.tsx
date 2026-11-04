// The hover actions on a Section or Entry: "Grill this", Copy (Sections only) and Discard.
import { Copy, MessageCircleQuestion, X } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'

interface RowActionsProps {
  onGrill?: () => void
  /** Copies the row for the Tracker. */
  onCopy?: () => void
  /** What lands on the clipboard, shown on hover over Copy. */
  copyTitle?: string
  onDiscard?: () => void
  grillDisabled: boolean
  entry?: boolean
}

/** Hidden until the pointer or focus is on the row: an Entry's own group, or a Section's heading. */
const REVEAL = {
  entry: 'group-focus-within/entry:opacity-100 group-hover/entry:opacity-100',
  section: 'group-focus-within/head:opacity-100 group-hover/head:opacity-100',
}

const DISCARD_TITLE = 'Discard — hidden and not published, restorable any time'

export function RowActions(props: Readonly<RowActionsProps>) {
  const { onGrill, onCopy, copyTitle, onDiscard, grillDisabled, entry = false } = props
  return (
    <span className={cn('flex shrink-0 items-center gap-0.5 opacity-0', entry ? REVEAL.entry : REVEAL.section)}>
      {onGrill && (
        <Button
          size="sm"
          variant="quiet"
          className="text-claude"
          onClick={onGrill}
          disabled={grillDisabled}
          title={grillDisabled ? 'A session is running on this Draft' : 'Start a Focused Session on this part'}
        >
          <MessageCircleQuestion size={14} /> Grill this
        </Button>
      )}
      {onCopy && (
        <Button size="sm" variant="quiet" onClick={onCopy} title={copyTitle}>
          <Copy size={14} /> Copy
        </Button>
      )}
      {onDiscard && (
        <Button size="sm" variant="quiet" onClick={onDiscard} title={DISCARD_TITLE}>
          <X size={14} /> Discard
        </Button>
      )}
    </span>
  )
}
