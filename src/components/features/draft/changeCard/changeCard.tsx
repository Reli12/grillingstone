// One change of a Proposal, shown inline where it would land. Clean Changes read as a proofreader's
// diff; Conflicts put the human's version beside Claude's and always need their own decision.
import type { Change } from '#core/proposal/proposalTypes.ts'
import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'
import { wordDiff } from '@/lib/wordDiff'

interface DiffProps {
  before: string
  after: string
}

function Diff({ before, after }: DiffProps) {
  return (
    <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">
      {wordDiff(before, after).map((p, i) =>
        p.op === 'same' ? (
          <span key={i}>{p.text}</span>
        ) : p.op === 'del' ? (
          <del key={i} className="text-redpencil decoration-redpencil decoration-2">
            {p.text}
          </del>
        ) : (
          <ins key={i} className="bg-proof-wash text-proof no-underline decoration-proof">
            {p.text}
          </ins>
        ),
      )}
    </p>
  )
}

interface ChangeCardProps {
  change: Change
  busy: boolean
  onDecide: (accept: boolean) => void
}

export function ChangeCard({ change, busy, onDecide }: ChangeCardProps) {
  const showBefore = change.before !== undefined && change.before !== '(Discarded by you)'
  return (
    <div
      className={cn('rounded-md border-l-[3px] py-2.5 pr-3 pl-3.5', change.conflict ? 'border-redpencil bg-redpencil-wash' : 'border-proof bg-proof-wash')}
      role="group"
      aria-label={`${change.conflict ? 'Conflict' : 'Clean Change'}: ${change.label}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('text-[13px] font-semibold', change.conflict ? 'text-redpencil' : 'text-proof')}>{change.conflict ? 'Conflict' : 'Clean Change'}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">{change.label}</span>
        {change.conflictReason && <span className="text-[13px] text-redpencil">{change.conflictReason}</span>}
      </div>

      {change.conflict && showBefore ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-line bg-sheet px-3 py-2">
            <p className="mb-1 text-[12px] font-medium text-ink-faint">Yours</p>
            <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">{change.before}</p>
          </div>
          <div className="rounded border border-line bg-sheet px-3 py-2">
            <p className="mb-1 text-[12px] font-medium text-ink-faint">Claude proposes</p>
            <Diff before={change.before!} after={change.after} />
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded border border-line bg-sheet px-3 py-2">
          {change.before === '(Discarded by you)' && <p className="mb-1 text-[12px] font-medium text-redpencil">Brings back something you discarded</p>}
          {showBefore ? <Diff before={change.before!} after={change.after} /> : <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap text-proof">{change.after}</p>}
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <Button size="sm" variant={change.conflict ? 'ink' : 'proof'} disabled={busy} onClick={() => onDecide(true)}>
          {change.conflict ? 'Take Claude’s' : 'Accept'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(false)}>
          {change.conflict ? 'Keep mine' : 'Reject'}
        </Button>
      </div>
    </div>
  )
}
