// One Entry row: draggable, with its ownership gutter, content and pending changes, or collapsed when Discarded.
import type { Change } from '#core/proposal/proposalTypes.ts'

import { Gutter } from '@/components/features/draft/margin/gutter/gutter'
import { Changes } from '@/components/features/draft/proposal/changes/changes'
import { DiscardedLine } from '@/components/features/draft/sheet/discardedLine/discardedLine'
import { EntryContent } from '@/components/features/draft/sheet/entryContent/entryContent'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import { useSortableRow } from '@/hooks/draft/useSortableRow'
import { cn } from '@/lib/cn'
import { pendingTone } from '@/lib/pendingTone'
import type { EntryProps } from '@/types/draft'

interface EntryRowProps extends EntryProps {
  changes: Change[]
}

export function EntryRow({ section, entry, changes }: Readonly<EntryRowProps>) {
  const { apply } = useDraftEditor()
  const { setNodeRef, style, isDragging, handleProps } = useSortableRow(entry.id)

  if (entry.discarded)
    return (
      <li ref={setNodeRef} style={style}>
        <DiscardedLine
          label={entry.title}
          changes={changes}
          onRestore={() => apply({ op: 'restoreEntry', sectionId: section.id, entryId: entry.id })}
        />
      </li>
    )

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('group/entry flex gap-1.5', isDragging && 'relative z-20 rounded bg-sheet shadow-lg')}
    >
      <Gutter
        size="entry"
        group="entry"
        edited={entry.humanEdited}
        moved={entry.humanMoved}
        pending={pendingTone(changes)}
        handleProps={handleProps}
      />
      <div className="min-w-0 flex-1 pb-1">
        <EntryContent section={section} entry={entry} />
        <Changes changes={changes} />
      </div>
    </li>
  )
}
