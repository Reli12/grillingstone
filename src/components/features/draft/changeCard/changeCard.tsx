// One change of a Proposal, shown inline where it would land. Clean Changes read as a proofreader's
// diff; Conflicts put the human's version beside Claude's and always need their own decision.
import type { ReactNode } from 'react'

import type { Change } from '#core/proposal/proposalTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'
import { type DiffPart, wordDiff } from '@/lib/wordDiff'

/** What `before` holds when the change brings back content the human discarded (set in core/proposal/classify.ts). */
const DISCARDED_MARKER = '(Discarded by you)'

function DiffRun({ part }: Readonly<{ part: DiffPart }>) {
  switch (part.op) {
    case 'same':
      return <span>{part.text}</span>
    case 'del':
      return <del className="text-redpencil decoration-redpencil decoration-2">{part.text}</del>
    case 'add':
      return <ins className="bg-proof-wash text-proof no-underline decoration-proof">{part.text}</ins>
  }
}

interface DiffProps {
  before: string
  after: string
}

function Diff({ before, after }: Readonly<DiffProps>) {
  return (
    <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">
      {wordDiff(before, after).map((part, i) => (
        <DiffRun key={i} part={part} />
      ))}
    </p>
  )
}

/** A white box with a small caption, holding one version of the text. */
function VersionBox({ caption, children }: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <div className="rounded border border-line bg-sheet px-3 py-2">
      <p className="mb-1 text-[12px] font-medium text-ink-faint">{caption}</p>
      {children}
    </div>
  )
}

/** The text of the change: a Conflict side by side, a Clean Change as a diff, new content in green. */
function ChangeBody({ change }: Readonly<{ change: Change }>) {
  const { before, after } = change
  const bringsBack = before === DISCARDED_MARKER
  const hasBefore = before !== undefined && !bringsBack
  if (change.conflict && hasBefore)
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <VersionBox caption="Yours">
          <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">{before}</p>
        </VersionBox>
        <VersionBox caption="Claude proposes">
          <Diff before={before} after={after} />
        </VersionBox>
      </div>
    )
  return (
    <div className="mt-2 rounded border border-line bg-sheet px-3 py-2">
      {bringsBack && <p className="mb-1 text-[12px] font-medium text-redpencil">Brings back something you discarded</p>}
      {hasBefore ? (
        <Diff before={before} after={after} />
      ) : (
        <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap text-proof">{after}</p>
      )}
    </div>
  )
}

interface ChangeCardProps {
  change: Change
  busy: boolean
  onDecide: (accept: boolean) => void
}

export function ChangeCard({ change, busy, onDecide }: Readonly<ChangeCardProps>) {
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

      <ChangeBody change={change} />

      <div className="mt-2.5 flex gap-2">
        <Button size="sm" variant={conflict ? 'ink' : 'proof'} disabled={busy} onClick={() => onDecide(true)}>
          {conflict ? 'Take Claude’s' : 'Accept'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(false)}>
          {conflict ? 'Keep mine' : 'Reject'}
        </Button>
      </div>
    </div>
  )
}
