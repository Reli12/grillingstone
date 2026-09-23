// The live Draft as one sheet of paper: Title, Sections in the human's order, the Iteration Log,
// and — while a Proposal is open — its changes inline where they would land.
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { formatLogDate } from '#core/publish/publishRenderer.ts'
import { ChangeCard } from '@/components/features/draft/changeCard/changeCard'
import { EditableText } from '@/components/features/draft/editableText/editableText'
import { Gutter } from '@/components/features/draft/gutter/gutter'
import { GutterLegend } from '@/components/features/draft/gutterLegend/gutterLegend'
import { SectionBlock } from '@/components/features/draft/sectionBlock/sectionBlock'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

export function DraftSheet() {
  const { draft, pending, apply, decide, busy } = useDraftEditor()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    apply({ op: 'moveSection', sectionId: String(active.id), toIndex: draft.sections.findIndex((s) => s.id === over.id) })
  }
  const titleChanges = pending.filter((c) => c.kind === 'retitle')
  const newSections = pending.filter((c) => c.kind === 'addSection')

  return (
    <article className="mx-auto w-full max-w-[860px]">
      <div className="flex gap-1">
        <Gutter edited={draft.titleHumanEdited} moved={false} pending={titleChanges.length ? (titleChanges.some((c) => c.conflict) ? 'conflict' : 'clean') : undefined} />
        <div className="min-w-0 flex-1">
          <EditableText value={draft.title} onSave={({ body }) => apply({ op: 'retitle', title: body.replace(/\s+/g, ' ') })}>
            <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-tight text-ink">{draft.title}</h1>
          </EditableText>
          {titleChanges.map((c) => (
            <div key={c.id} className="mt-2">
              <ChangeCard change={c} busy={busy} onDecide={(a) => decide(c.id, a)} />
            </div>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draft.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-8 space-y-8">
            {draft.sections.map((s) => (
              <SectionBlock key={s.id} section={s} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {newSections.length > 0 && (
        <div className="mt-8 space-y-3 pl-8">
          {newSections.map((c) => (
            <ChangeCard key={c.id} change={c} busy={busy} onDecide={(a) => decide(c.id, a)} />
          ))}
        </div>
      )}

      <section className="mt-10 border-t border-line-soft pt-5 pl-8" aria-label={draft.template.iterationLogHeading}>
        <h2 className="font-serif text-[17px] font-semibold text-ink">{draft.template.iterationLogHeading}</h2>
        <ol className="mt-2 space-y-1 font-serif text-[14px] text-ink-soft">
          {draft.iterationLog.map((l) => (
            <li key={l.version}>
              <span className="text-ink">
                {formatLogDate(l.date)} - @{l.author} v{l.version}
              </span>{' '}
              <span className="text-ink-faint">{l.note}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 pb-4 pl-8">
        <GutterLegend />
      </div>
    </article>
  )
}
