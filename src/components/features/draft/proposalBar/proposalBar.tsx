import type { Proposal } from '#core/proposal/proposalTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { SESSION_TITLES } from '@/constants/SessionConstants'

interface ProposalBarProps {
  proposal: Proposal
  busy: boolean
  onAcceptClean: () => void
}

/** Sticky summary of the open Proposal: Clean Changes go in one click, Conflicts one by one. */
export function ProposalBar({ proposal, busy, onAcceptClean }: ProposalBarProps) {
  const pending = proposal.changes.filter((c) => c.status === 'pending')
  const clean = pending.filter((c) => !c.conflict).length
  const conflicts = pending.length - clean
  const decided = proposal.changes.length - pending.length
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-sheet/95 px-4 py-2.5 backdrop-blur sm:-mx-10 sm:px-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm">
          <span className="font-semibold">Proposal</span>
          <span className="text-ink-soft"> from the {SESSION_TITLES[proposal.kind]}: </span>
          <span className={clean ? 'font-medium text-proof' : 'text-ink-faint'}>{clean} Clean</span>
          <span className="text-ink-faint">, </span>
          <span className={conflicts ? 'font-medium text-redpencil' : 'text-ink-faint'}>
            {conflicts} Conflict{conflicts === 1 ? '' : 's'}
          </span>
          {decided > 0 && <span className="text-ink-faint">, {decided} decided</span>}
        </p>
        <span className="ml-auto" />
        {conflicts > 0 && (
          <span className="text-[13px] text-ink-faint">Conflicts touch your edits — decide each in place.</span>
        )}
        <Button size="sm" variant="proof" disabled={!clean || busy} onClick={onAcceptClean}>
          Accept all clean ({clean})
        </Button>
      </div>
    </div>
  )
}
