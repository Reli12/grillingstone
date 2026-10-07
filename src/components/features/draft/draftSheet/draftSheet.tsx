// The live Draft as one sheet of paper: Title, Sections in the human's order, the Iteration Log,
// and — while a Proposal is open — its changes inline where they would land.
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

import type { IterationLogLine } from '#core/draft/draftTypes.ts'
import type { Change } from '#core/proposal/proposalTypes.ts'
import { formatLogDate } from '#core/publish/publishRenderer.ts'

import { ChangeCard } from '@/components/features/draft/changeCard/changeCard'
import { EditableText } from '@/components/features/draft/editableText/editableText'
import { Gutter } from '@/components/features/draft/gutter/gutter'
import { GutterLegend } from '@/components/features/draft/gutterLegend/gutterLegend'
import { SectionBlock } from '@/components/features/draft/sectionBlock/sectionBlock'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

/** A press must move this far before it becomes a drag, so a click on a Section still edits it. */
const DRAG_START_DISTANCE_PX = 4
const WHITESPACE_RUN = /\s+/g // any run of spaces, tabs or newlines

/** The gutter's mark for pending changes: red if any is a Conflict, green if all are clean. */
function pendingTone(changes: Change[]) {
  if (!changes.length) return undefined
  return changes.some((change) => change.conflict) ? 'conflict' : 'clean'
}

/** The Draft's Title, editable in place, with any pending retitle beneath it. */
function TitleBlock() {
  const { draft, pending, apply, decide, busy } = useDraftEditor()
  const titleChanges = pending.filter((change) => change.kind === 'retitle')
  // A title is one line: newlines typed into the editor collapse to single spaces.
  const saveTitle = (body: string) => apply({ op: 'retitle', title: body.replace(WHITESPACE_RUN, ' ') })
  return (
    <div className="flex gap-1">
      <Gutter edited={draft.titleHumanEdited} moved={false} pending={pendingTone(titleChanges)} />
      <div className="min-w-0 flex-1">
        <EditableText value={draft.title} onSave={({ body }) => saveTitle(body)}>
          <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-tight text-ink">{draft.title}</h1>
        </EditableText>
        {titleChanges.map((change) => (
          <div key={change.id} className="mt-2">
            <ChangeCard change={change} busy={busy} onDecide={(accept) => decide(change.id, accept)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The Sections in the human's order; dragging one by its handle moves it. */
function SortableSections() {
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

/** Proposed new Sections, shown after the existing ones until they are decided. */
function NewSectionChanges() {
  const { pending, decide, busy } = useDraftEditor()
  const newSections = pending.filter((change) => change.kind === 'addSection')
  if (newSections.length === 0) return null
  return (
    <div className="mt-8 space-y-3 pl-8">
      {newSections.map((change) => (
        <ChangeCard key={change.id} change={change} busy={busy} onDecide={(accept) => decide(change.id, accept)} />
      ))}
    </div>
  )
}

function IterationLog({ heading, log }: Readonly<{ heading: string; log: IterationLogLine[] }>) {
  return (
    <section className="mt-10 border-t border-line-soft pt-5 pl-8" aria-label={heading}>
      <h2 className="font-serif text-[17px] font-semibold text-ink">{heading}</h2>
      <ol className="mt-2 space-y-1 font-serif text-[14px] text-ink-soft">
        {log.map((line) => (
          <li key={line.version}>
            <span className="text-ink">
              {formatLogDate(line.date)} - @{line.author} v{line.version}
            </span>{' '}
            <span className="text-ink-faint">{line.note}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function DraftSheet() {
  const { draft } = useDraftEditor()
  return (
    <article className="mx-auto w-full max-w-[860px]">
      <TitleBlock />
      <SortableSections />
      <NewSectionChanges />
      <IterationLog heading={draft.template.iterationLogHeading} log={draft.iterationLog} />
      <div className="mt-10 pb-4 pl-8">
        <GutterLegend />
      </div>
    </article>
  )
}
