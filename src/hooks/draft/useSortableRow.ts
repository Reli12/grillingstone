// Makes a Section or Entry draggable: the props for its element and for its gutter's drag handle.
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** Makes a Section or Entry draggable: the props for its element and for its gutter's drag handle. */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return { setNodeRef, style, isDragging, handleProps: { ...attributes, ...listeners } }
}
