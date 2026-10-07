// The edits a human makes to a Draft. Every edit sets the markers (humanEdited / humanMoved / discarded)
// that decide later whether a change is a Conflict (ADR-0005). An open Proposal is not touched here:
// use applyHumanEdit (proposal/humanEdit.ts) to re-derive its Conflicts too.
import { newEntry } from '#core/draft/draft.ts'
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'

export type HumanOp =
  | { op: 'retitle'; title: string }
  | { op: 'editSection'; sectionId: string; body: string }
  | { op: 'editEntry'; sectionId: string; entryId: string; title?: string; body?: string }
  | { op: 'addEntry'; sectionId: string; title: string; body: string }
  | { op: 'moveSection'; sectionId: string; toIndex: number }
  | { op: 'moveEntry'; sectionId: string; entryId: string; toIndex: number }
  | { op: 'discardSection' | 'restoreSection'; sectionId: string }
  | { op: 'discardEntry' | 'restoreEntry'; sectionId: string; entryId: string }

export class DraftOpError extends Error {}

/** Moves the item with `id` to `toIndex` (clamped to the list), marking it with `mark` when it moves. */
const moveTo = <T extends { id: string }>(list: T[], id: string, toIndex: number, mark: (item: T) => T): T[] => {
  const from = list.findIndex((item) => item.id === id)
  if (from < 0) throw new DraftOpError(`Nothing with id ${id} to move`)
  const to = Math.max(0, Math.min(list.length - 1, toIndex))
  if (from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, mark(item))
  return next
}

/** The Draft with one Section replaced by `edit(section)`. */
const withSection = (draft: Draft, section: Section, edit: (section: Section) => Section): Draft => ({
  ...draft,
  sections: draft.sections.map((candidate) => (candidate.id === section.id ? edit(candidate) : candidate)),
})

/** The Draft with one Entry of `section` replaced by `edit(entry)`. */
const withEntry = (draft: Draft, section: Section, entryId: string, edit: (entry: Entry) => Entry): Draft => {
  if (!section.entries.some((entry) => entry.id === entryId)) throw new DraftOpError(`No Entry ${entryId}`)
  return withSection(draft, section, (current) => ({
    ...current,
    entries: current.entries.map((entry) => (entry.id === entryId ? edit(entry) : entry)),
  }))
}

/** The ops that act on one Section or its Entries; `section` is the one named by op.sectionId. */
function applySectionOp(draft: Draft, section: Section, op: Exclude<HumanOp, { op: 'retitle' }>): Draft {
  switch (op.op) {
    case 'editSection':
      return withSection(draft, section, (current) => ({ ...current, body: op.body, humanEdited: true }))
    case 'editEntry':
      return withEntry(draft, section, op.entryId, (entry) => ({
        ...entry,
        title: op.title ?? entry.title,
        body: op.body ?? entry.body,
        humanEdited: true,
      }))
    case 'addEntry':
      if (section.shape !== 'entries') throw new DraftOpError(`"${section.heading}" holds prose, not Entries`)
      return withSection(draft, section, (current) => ({
        ...current,
        entries: [...current.entries, { ...newEntry(op.title, op.body), humanEdited: true }],
      }))
    case 'moveSection': {
      const markMoved = (moved: Section) => ({ ...moved, humanMoved: true })
      return { ...draft, sections: moveTo(draft.sections, op.sectionId, op.toIndex, markMoved) }
    }
    case 'moveEntry':
      return withSection(draft, section, (current) => ({
        ...current,
        entries: moveTo(current.entries, op.entryId, op.toIndex, (entry) => ({ ...entry, humanMoved: true })),
      }))
    case 'discardSection':
      if (section.locked)
        throw new DraftOpError(`"${section.heading}" is a Locked Section — it can be edited and moved, never Discarded`)
      return withSection(draft, section, (current) => ({ ...current, discarded: true }))
    case 'restoreSection':
      return withSection(draft, section, (current) => ({ ...current, discarded: false }))
    case 'discardEntry':
      return withEntry(draft, section, op.entryId, (entry) => ({ ...entry, discarded: true }))
    case 'restoreEntry':
      return withEntry(draft, section, op.entryId, (entry) => ({ ...entry, discarded: false }))
    default:
      throw new DraftOpError(`Unknown edit ${String((op as { op?: unknown }).op)}`)
  }
}

export function applyHumanOp(draft: Draft, op: HumanOp): Draft {
  if (draft.version === 0) throw new DraftOpError('There is no Draft to edit before v1 is written')
  const section = 'sectionId' in op ? draft.sections.find((candidate) => candidate.id === op.sectionId) : undefined
  if ('sectionId' in op && !section) throw new DraftOpError(`No Section ${op.sectionId}`)
  if (op.op === 'retitle') {
    if (!op.title.trim()) throw new DraftOpError('A Draft needs a Title')
    return { ...draft, title: op.title.trim(), titleHumanEdited: true }
  }
  // Every op other than retitle names a Section; one that does not is not an edit we know.
  if (!section) throw new DraftOpError(`Unknown edit ${String((op as { op?: unknown }).op)}`)
  return applySectionOp(draft, section, op)
}
