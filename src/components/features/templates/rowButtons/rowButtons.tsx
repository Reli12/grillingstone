// Move up, move down and remove; a Template keeps at least one Section.
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'

export interface RowButtonsProps {
  index: number
  count: number
  readOnly: boolean
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

/** Move up, move down and remove; a Template keeps at least one Section. */
export function RowButtons({ index, count, readOnly, onMove, onRemove }: Readonly<RowButtonsProps>) {
  return (
    <span className="flex items-center gap-0.5">
      <Button
        size="sm"
        variant="quiet"
        aria-label="Move up"
        disabled={readOnly || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp size={14} />
      </Button>
      <Button
        size="sm"
        variant="quiet"
        aria-label="Move down"
        disabled={readOnly || index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown size={14} />
      </Button>
      <Button
        size="sm"
        variant="danger"
        aria-label="Remove Section"
        disabled={readOnly || count === 1}
        onClick={() => onRemove(index)}
      >
        <Trash2 size={14} />
      </Button>
    </span>
  )
}
