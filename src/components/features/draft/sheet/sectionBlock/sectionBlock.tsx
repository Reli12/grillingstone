// One Section of the Draft sheet: its heading and actions, its prose or sortable Entries, and the
// Proposal changes that would land in it. Discarded Sections and Entries fold into a restorable line.

import { Gutter } from '@/components/features/draft/margin/gutter/gutter'
import { Changes } from '@/components/features/draft/proposal/changes/changes'
import { DiscardedLine } from '@/components/features/draft/sheet/discardedLine/discardedLine'
import { SectionBody } from '@/components/features/draft/sheet/sectionBody/sectionBody'
import { SectionHeader } from '@/components/features/draft/sheet/sectionHeader/sectionHeader'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import { useSortableRow } from '@/hooks/draft/useSortableRow'
import { cn } from '@/lib/cn'
import { pendingTone } from '@/lib/pendingTone'
import type { SectionProps } from '@/types/draft'

export function SectionBlock({ section }: Readonly<SectionProps>) {
  const { apply, pending: allPending } = useDraftEditor()
  const { setNodeRef, style, isDragging, handleProps } = useSortableRow(section.id)
  const pending = allPending.filter((change) => change.sectionId === section.id)
  const sectionLevel = pending.filter((change) => !change.entryId)

  if (section.discarded)
    return (
      <section ref={setNodeRef} style={style} className="pl-7">
        <DiscardedLine
          label={section.heading}
          changes={pending}
          onRestore={() => apply({ op: 'restoreSection', sectionId: section.id })}
        />
      </section>
    )

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={section.heading}
      className={cn('group/section flex gap-1', isDragging && 'relative z-20 rounded-md bg-sheet shadow-xl')}
    >
      <Gutter
        edited={section.humanEdited}
        moved={section.humanMoved}
        pending={pendingTone(pending)}
        handleProps={handleProps}
      />
      <div className="min-w-0 flex-1">
        <SectionHeader section={section} />
        <div className="mt-1.5">
          <SectionBody section={section} pending={pending} />
        </div>
        <Changes changes={sectionLevel} />
      </div>
    </section>
  )
}
