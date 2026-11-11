// A DraftCard the human can drag to another Lane or to the Archive tray. The card's link stays the focusable
// element; while dragged, the original fades and the board's overlay follows the pointer.
import { useDraggable } from '@dnd-kit/core'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { DraftCard } from '@/components/features/drafts/draftCard/draftCard'
import { cn } from '@/lib/cn'

export function DraggableDraftCard({ draft }: Readonly<{ draft: DraftSummary }>) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: draft.id })
  return (
    <div ref={setNodeRef} {...listeners} className={cn('touch-none', isDragging && 'opacity-30')}>
      <DraftCard draft={draft} />
    </div>
  )
}
