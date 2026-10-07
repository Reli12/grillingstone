// The hover actions on a Section or Entry: "Grill this" and Discard.
import { MessageCircleQuestion, X } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'

interface RowActionsProps {
  onGrill?: () => void
  onDiscard?: () => void
  grillDisabled: boolean
  entry?: boolean
}

export function RowActions({ onGrill, onDiscard, grillDisabled, entry = false }: Readonly<RowActionsProps>) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-0.5 opacity-0',
        entry
          ? 'group-focus-within/entry:opacity-100 group-hover/entry:opacity-100'
          : 'group-focus-within/head:opacity-100 group-hover/head:opacity-100',
      )}
    >
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
      {onDiscard && (
        <Button
          size="sm"
          variant="quiet"
          onClick={onDiscard}
          title="Discard — hidden and not published, restorable any time"
        >
          <X size={14} /> Discard
        </Button>
      )}
    </span>
  )
}
