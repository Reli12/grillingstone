// One Lane of the Project board: a drop target whose cards scroll inside it. Collapsed, it is a narrow strip that
// still takes drops and still shows when a Draft in it needs the human.
import { useDroppable } from '@dnd-kit/core'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { DraftLane } from '#core/draft/draftLane.ts'

import { DraggableDraftCard } from '@/components/features/drafts/draggableDraftCard/draggableDraftCard'
import { cn } from '@/lib/cn'
import { needsYou } from '@/lib/draftSummary'

interface LaneColumnProps {
  lane: DraftLane
  label: string
  /** Border colour class of the column's top edge. */
  accent: string
  /** The Drafts in this Lane that pass the filters. */
  drafts: DraftSummary[]
  /** Every open Draft in this Lane, filtered or not. */
  total: number
  collapsed: boolean
  onToggle: () => void
}

export function LaneColumn({ lane, label, accent, drafts, total, collapsed, onToggle }: Readonly<LaneColumnProps>) {
  const { setNodeRef, isOver } = useDroppable({ id: lane })
  const frame = cn('rounded-lg border border-t-4 border-line bg-fog/40', accent, isOver && 'ring-2 ring-claude')

  if (collapsed)
    return (
      <section ref={setNodeRef} aria-label={label} className={cn('w-10 shrink-0', frame)}>
        <button
          type="button"
          title={`Expand ${label}`}
          onClick={onToggle}
          className="flex h-full w-full flex-col items-center gap-2 py-2 text-[13px] font-semibold"
        >
          <ChevronRight size={14} />
          <span className="[writing-mode:vertical-rl]">
            {label} · {drafts.length}
          </span>
          {drafts.some(needsYou) && <AlertCircle size={13} className="text-redpencil" />}
        </button>
      </section>
    )

  return (
    <section ref={setNodeRef} aria-label={label} className={cn('flex min-w-0 flex-1 flex-col', frame)}>
      <header className="flex items-center gap-1 px-2 pt-2 pb-1.5">
        <button type="button" title={`Collapse ${label}`} className="text-ink-faint hover:text-ink" onClick={onToggle}>
          <ChevronDown size={14} />
        </button>
        <h2 className="flex-1 text-sm font-semibold">{label}</h2>
        <span className="text-[12px] text-ink-faint">
          {drafts.length === total ? total : `${drafts.length} of ${total}`}
        </span>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {drafts.map((draft) => (
          <DraggableDraftCard key={draft.id} draft={draft} />
        ))}
      </div>
    </section>
  )
}
