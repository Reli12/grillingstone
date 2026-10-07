// One Section of the Draft sheet: its heading and actions, its prose or sortable Entries, and the
// Proposal changes that would land in it. Discarded Sections and Entries fold into a restorable line.
import { useState } from 'react'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lock, MessageCircleQuestion, Plus, Undo2, X } from 'lucide-react'

import type { Entry, Section } from '#core/draft/draftTypes.ts'
import type { Change } from '#core/proposal/proposalTypes.ts'
import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'

import { Button } from '@/components/atoms/button/button'
import { RichText } from '@/components/atoms/richText/richText'
import { Tag } from '@/components/atoms/tag/tag'
import { AddEntryForm } from '@/components/features/draft/addEntryForm/addEntryForm'
import { ChangeCard } from '@/components/features/draft/changeCard/changeCard'
import { EditableText } from '@/components/features/draft/editableText/editableText'
import { Gutter } from '@/components/features/draft/gutter/gutter'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import { cn } from '@/lib/cn'

/** A press must move this far before it becomes a drag, so a click on an Entry still edits it. */
const DRAG_START_DISTANCE_PX = 4

/** The gutter's mark for pending changes: red if any is a Conflict, green if all are clean. */
function pendingTone(changes: Change[]) {
  if (!changes.length) return undefined
  return changes.some((change) => change.conflict) ? 'conflict' : 'clean'
}

/** Makes a Section or Entry draggable: the props for its element and for its gutter's drag handle. */
function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return { setNodeRef, style, isDragging, handleProps: { ...attributes, ...listeners } }
}

interface ChangesProps {
  changes: Change[]
}

function Changes({ changes }: Readonly<ChangesProps>) {
  const { decide, busy } = useDraftEditor()
  if (!changes.length) return null
  return (
    <div className="mt-2 space-y-2">
      {changes.map((change) => (
        <ChangeCard key={change.id} change={change} busy={busy} onDecide={(accept) => decide(change.id, accept)} />
      ))}
    </div>
  )
}

interface RowActionsProps {
  onGrill?: () => void
  onDiscard?: () => void
  grillDisabled: boolean
  entry?: boolean
}

function RowActions({ onGrill, onDiscard, grillDisabled, entry = false }: Readonly<RowActionsProps>) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-0.5 opacity-0',
        entry
          ? 'group-focus-within/entry:opacity-100 group-hover/entry:opacity-100'
          : 'group-focus-within/head:opacity-100 group-hover/head:opacity-100',
      )}
    >
      {onGrill && (
        <Button
          size="sm"
          variant="quiet"
          className="text-claude"
          onClick={onGrill}
          disabled={grillDisabled}
          title={grillDisabled ? 'A session is running on this Draft' : 'Start a Focused Session on this part'}
        >
          <MessageCircleQuestion size={14} /> Grill this
        </Button>
      )}
      {onDiscard && (
        <Button
          size="sm"
          variant="quiet"
          onClick={onDiscard}
          title="Discard — hidden and not published, restorable any time"
        >
          <X size={14} /> Discard
        </Button>
      )}
    </span>
  )
}

interface DiscardedLineProps {
  label: string
  onRestore: () => void
  changes: Change[]
}

function DiscardedLine({ label, onRestore, changes }: Readonly<DiscardedLineProps>) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded border border-dashed border-line px-2.5 py-1.5 text-[13px] text-ink-faint">
        <span className="min-w-0 flex-1 truncate line-through">{label}</span>
        <span className="shrink-0">Discarded</span>
        <Button size="sm" variant="quiet" onClick={onRestore}>
          <Undo2 size={13} /> Restore
        </Button>
      </div>
      <Changes changes={changes} />
    </div>
  )
}

interface EntryProps {
  section: Section
  entry: Entry
}

/** The Entry's title and text, editable in place, with its Grill and Discard actions. */
function EntryContent({ section, entry }: Readonly<EntryProps>) {
  const { apply, grill, sessionRunning } = useDraftEditor()
  const target = { sectionId: section.id, entryId: entry.id }
  return (
    <div className="flex items-start gap-2">
      <EditableText
        className="min-w-0 flex-1"
        value={entry.body}
        title={entry.title}
        onSave={({ body, title }) => apply({ op: 'editEntry', ...target, body, title })}
      >
        <p className="font-serif text-[15px] leading-7 font-semibold text-ink">{entry.title}</p>
        <RichText text={entry.body} className="font-serif text-[15px] leading-7 text-ink" />
      </EditableText>
      <RowActions
        entry
        grillDisabled={sessionRunning}
        onGrill={() => grill({ ...target, heading: `${section.heading} › ${entry.title}` })}
        onDiscard={() => apply({ op: 'discardEntry', ...target })}
      />
    </div>
  )
}

interface EntryRowProps extends EntryProps {
  changes: Change[]
}

function EntryRow({ section, entry, changes }: Readonly<EntryRowProps>) {
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

interface AddEntryProps {
  section: Section
}

function AddEntry({ section }: Readonly<AddEntryProps>) {
  const { apply } = useDraftEditor()
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <Button size="sm" variant="quiet" className="mt-1 ml-5" onClick={() => setOpen(true)}>
        <Plus size={14} /> Add Entry
      </Button>
    )
  return (
    <div className="mt-2 ml-6">
      <AddEntryForm
        onCancel={() => setOpen(false)}
        onSave={(title, body) => {
          apply({ op: 'addEntry', sectionId: section.id, title, body })
          setOpen(false)
        }}
      />
    </div>
  )
}

interface EntriesProps {
  section: Section
  pending: Change[]
}

function Entries({ section, pending }: Readonly<EntriesProps>) {
  const { apply } = useDraftEditor()
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
  return (
    <>
      {live.length === 0 && section.body && (
        <RichText text={section.body} className="ml-6 font-serif text-[15px] leading-7 text-ink-soft italic" />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={section.entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {section.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                section={section}
                entry={entry}
                changes={pending.filter((change) => change.entryId === entry.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddEntry section={section} />
    </>
  )
}

interface SectionProps {
  section: Section
}

/** The Section's heading line: name, lock, the ADO field it publishes to, and its actions. */
function SectionHeader({ section }: Readonly<SectionProps>) {
  const { apply, grill, sessionRunning } = useDraftEditor()
  // A locked Section can never be discarded, so it offers no Discard action.
  const discard = section.locked ? undefined : () => apply({ op: 'discardSection', sectionId: section.id })
  return (
    <header className="group/head flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
      <h2 className="font-serif text-[19px] font-semibold tracking-tight text-ink">{section.heading}</h2>
      {section.locked && (
        <span className="text-ink-faint" title="Locked Section — you can edit and move it, never discard it">
          <Lock size={14} aria-label="Locked" />
        </span>
      )}
      <Tag tone="claude" title="The Azure DevOps field this Section is copied into">
        {ADO_FIELD_LABELS[section.target] ?? section.target}
      </Tag>
      <span className="ml-auto" />
      <RowActions
        grillDisabled={sessionRunning}
        onGrill={() => grill({ sectionId: section.id, heading: section.heading })}
        onDiscard={discard}
      />
    </header>
  )
}

/** A prose Section's text, editable in place; an Entries Section's sortable list. */
function SectionBody({ section, pending }: Readonly<EntriesProps>) {
  const { apply } = useDraftEditor()
  if (section.shape !== 'prose') return <Entries section={section} pending={pending} />
  return (
    <EditableText value={section.body} onSave={({ body }) => apply({ op: 'editSection', sectionId: section.id, body })}>
      <RichText text={section.body} className="font-serif text-[15px] leading-7 text-ink" />
    </EditableText>
  )
}

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
