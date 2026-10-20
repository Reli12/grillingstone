// One change of a Proposal, shown inline where it would land. Clean Changes read as a proofreader's
// diff; Conflicts put the human's version beside the Assistant's and always need their own decision.

import type { Change } from '#core/proposal/proposalTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { ChangeBody } from '@/components/features/draft/proposal/changeBody/changeBody'
import { cn } from '@/lib/cn'

interface ChangeCardProps {
  change: Change
  /** The name of the Assistant that proposed it. */
  assistant: string
  busy: boolean
  onDecide: (accept: boolean) => void
}

export function ChangeCard({ change, assistant, busy, onDecide }: Readonly<ChangeCardProps>) {
  const { conflict } = change
  const kindLabel = conflict ? 'Conflict' : 'Clean Change'
  return (
    <div
      className={cn(
        'rounded-md border-l-[3px] py-2.5 pr-3 pl-3.5',
        conflict ? 'border-redpencil bg-redpencil-wash' : 'border-proof bg-proof-wash',
      )}
      role="group"
      aria-label={`${kindLabel}: ${change.label}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('text-[13px] font-semibold', conflict ? 'text-redpencil' : 'text-proof')}>{kindLabel}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">{change.label}</span>
        {change.conflictReason && <span className="text-[13px] text-redpencil">{change.conflictReason}</span>}
      </div>

      <ChangeBody change={change} assistant={assistant} />

      <div className="mt-2.5 flex gap-2">
        <Button size="sm" variant={conflict ? 'ink' : 'proof'} disabled={busy} onClick={() => onDecide(true)}>
          {conflict ? `Take ${assistant}’s` : 'Accept'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(false)}>
          {conflict ? 'Keep mine' : 'Reject'}
        </Button>
      </div>
    </div>
  )
}
