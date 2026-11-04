// A Section's Entries as a drag-and-drop list, with "Add Entry" at the end.
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

import { RichText } from '@/components/atoms/richText/richText'
import { AddEntry } from '@/components/features/draft/sheet/addEntry/addEntry'
import { EntryRow } from '@/components/features/draft/sheet/entryRow/entryRow'
import { DRAG_START_DISTANCE_PX } from '@/constants/DragConstants'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import type { EntriesProps } from '@/types/draft'

export function Entries({ section, pending }: Readonly<EntriesProps>) {
  const { apply } = useDraftEditor()
  const showDiscarded = useDiscardedVisibility().showsInSection(section.id)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = section.entries.findIndex((entry) => entry.id === over.id)
    apply({ op: 'moveEntry', sectionId: section.id, entryId: String(active.id), toIndex })
  }
  const live = section.entries.filter((entry) => !entry.discarded)
  const changesOf = (entryId: string) => pending.filter((change) => change.entryId === entryId)
  // A hidden Discarded Entry still shows while a change waits on it, so no decision is ever out of sight.
  const shown = section.entries.filter((entry) => !entry.discarded || showDiscarded || changesOf(entry.id).length > 0)
  return (
    <>
      {live.length === 0 && section.body && (
        <RichText text={section.body} className="ml-6 font-serif text-[15px] leading-7 text-ink-soft italic" />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {shown.map((entry) => (
              <EntryRow key={entry.id} section={section} entry={entry} changes={changesOf(entry.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddEntry section={section} />
    </>
  )
}
