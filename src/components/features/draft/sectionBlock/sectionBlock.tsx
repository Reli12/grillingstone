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

const pendingTone = (changes: Change[]) =>
  changes.some((c) => c.conflict) ? 'conflict' : changes.length ? 'clean' : undefined

interface ChangesProps {
  changes: Change[]
}

function Changes({ changes }: ChangesProps) {
  const { decide, busy } = useDraftEditor()
  if (!changes.length) return null
  return (
    <div className="mt-2 space-y-2">
      {changes.map((c) => (
        <ChangeCard key={c.id} change={c} busy={busy} onDecide={(accept) => decide(c.id, accept)} />
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

function RowActions({ onGrill, onDiscard, grillDisabled, entry = false }: RowActionsProps) {
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

function DiscardedLine({ label, onRestore, changes }: DiscardedLineProps) {
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

interface EntryRowProps {
  section: Section
  entry: Entry
  changes: Change[]
}

function EntryRow({ section, entry, changes }: EntryRowProps) {
  const { apply, grill, sessionRunning } = useDraftEditor()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

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
        handleProps={{ ...attributes, ...listeners }}
      />
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex items-start gap-2">
          <EditableText
            className="min-w-0 flex-1"
            value={entry.body}
            title={entry.title}
            onSave={({ body, title }) =>
              apply({ op: 'editEntry', sectionId: section.id, entryId: entry.id, body, title })
            }
          >
            <p className="font-serif text-[15px] leading-7 font-semibold text-ink">{entry.title}</p>
            <RichText text={entry.body} className="font-serif text-[15px] leading-7 text-ink" />
          </EditableText>
          <RowActions
            entry
            grillDisabled={sessionRunning}
            onGrill={() =>
              grill({ sectionId: section.id, entryId: entry.id, heading: `${section.heading} › ${entry.title}` })
            }
            onDiscard={() => apply({ op: 'discardEntry', sectionId: section.id, entryId: entry.id })}
          />
        </div>
        <Changes changes={changes} />
      </div>
    </li>
  )
}

interface AddEntryProps {
  section: Section
}

function AddEntry({ section }: AddEntryProps) {
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

function Entries({ section, pending }: EntriesProps) {
  const { apply } = useDraftEditor()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = section.entries.findIndex((e) => e.id === over.id)
    apply({ op: 'moveEntry', sectionId: section.id, entryId: String(active.id), toIndex })
  }
  const live = section.entries.filter((e) => !e.discarded)
  return (
    <>
      {live.length === 0 && section.body && (
        <RichText text={section.body} className="ml-6 font-serif text-[15px] leading-7 text-ink-soft italic" />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={section.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {section.entries.map((e) => (
              <EntryRow key={e.id} section={section} entry={e} changes={pending.filter((c) => c.entryId === e.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddEntry section={section} />
    </>
  )
}

interface SectionBlockProps {
  section: Section
}

export function SectionBlock({ section }: SectionBlockProps) {
  const { apply, grill, pending: allPending, sessionRunning } = useDraftEditor()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const pending = allPending.filter((c) => c.sectionId === section.id)
  const sectionLevel = pending.filter((c) => !c.entryId)

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
        handleProps={{ ...attributes, ...listeners }}
      />
      <div className="min-w-0 flex-1">
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
            onDiscard={section.locked ? undefined : () => apply({ op: 'discardSection', sectionId: section.id })}
          />
        </header>
        <div className="mt-1.5">
          {section.shape === 'prose' ? (
            <EditableText
              value={section.body}
              onSave={({ body }) => apply({ op: 'editSection', sectionId: section.id, body })}
            >
              <RichText text={section.body} className="font-serif text-[15px] leading-7 text-ink" />
            </EditableText>
          ) : (
            <Entries section={section} pending={pending} />
          )}
        </div>
        <Changes changes={sectionLevel} />
      </div>
    </section>
  )
}
