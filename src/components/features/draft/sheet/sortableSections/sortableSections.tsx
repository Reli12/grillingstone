// The Sections in the human's order; dragging one by its handle moves it.
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { SectionBlock } from '@/components/features/draft/sheet/sectionBlock/sectionBlock'
import { DRAG_START_DISTANCE_PX } from '@/constants/DragConstants'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

/** The Sections in the human's order; dragging one by its handle moves it. */
export function SortableSections() {
  const { draft, apply } = useDraftEditor()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = draft.sections.findIndex((section) => section.id === over.id)
    apply({ op: 'moveSection', sectionId: String(active.id), toIndex })
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={draft.sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-8 space-y-8">
          {draft.sections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
