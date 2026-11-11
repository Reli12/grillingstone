// The Project board (ADR-0019): a column per Lane, Drafts dragged between them, and an Archive tray that appears
// while a card is dragged. Columns scroll on their own, so the page never does.
import { useState } from 'react'

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Archive } from 'lucide-react'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import { type DraftLane, isDraftLane } from '#core/draft/draftLane.ts'

import { DraftCard } from '@/components/features/drafts/draftCard/draftCard'
import { LaneColumn } from '@/components/features/drafts/laneColumn/laneColumn'
import { ARCHIVE_DROP_ID, LANE_COLUMNS } from '@/constants/DraftBoardConstants'
import { DRAG_START_DISTANCE_PX } from '@/constants/DragConstants'
import { cn } from '@/lib/cn'

const toggled = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

interface DraftBoardProps {
  /** Every open Draft, for the per-Lane totals. */
  drafts: DraftSummary[]
  /** The open Drafts that pass the filters. */
  shown: DraftSummary[]
  onMove: (draftId: string, lane: DraftLane) => void
  onArchive: (draftId: string) => void
}

function ArchiveTray() {
  const { setNodeRef, isOver } = useDroppable({ id: ARCHIVE_DROP_ID })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute inset-x-0 bottom-0 z-10 flex h-16 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-proof text-sm font-medium shadow-lg',
        isOver ? 'bg-proof text-on-accent' : 'bg-proof-wash text-proof',
      )}
    >
      <Archive size={16} /> Drop here to archive
    </div>
  )
}

export function DraftBoard({ drafts, shown, onMove, onArchive }: Readonly<DraftBoardProps>) {
  // A press must travel before it drags, so a click on a card's title still opens the Draft.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE_PX } }))
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<DraftLane[]>([])
  const dragged = drafts.find((draft) => draft.id === draggedId)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedId(null)
    const draftId = String(active.id)
    const target = over ? String(over.id) : null
    if (target === ARCHIVE_DROP_ID) onArchive(draftId)
    else if (isDraftLane(target) && drafts.find((draft) => draft.id === draftId)?.lane !== target)
      onMove(draftId, target)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setDraggedId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggedId(null)}
    >
      <div className="relative flex min-w-0 flex-1 gap-3">
        {LANE_COLUMNS.map(({ lane, label, accent }) => (
          <LaneColumn
            key={lane}
            lane={lane}
            label={label}
            accent={accent}
            drafts={shown.filter((draft) => draft.lane === lane)}
            total={drafts.filter((draft) => draft.lane === lane).length}
            collapsed={collapsed.includes(lane)}
            onToggle={() => setCollapsed((current) => toggled(current, lane))}
          />
        ))}
        {dragged && <ArchiveTray />}
      </div>
      <DragOverlay>{dragged ? <DraftCard draft={dragged} lifted /> : null}</DragOverlay>
    </DndContext>
  )
}
