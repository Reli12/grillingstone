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

const moveTo = <T extends { id: string }>(list: T[], id: string, toIndex: number, mark: (x: T) => T): T[] => {
  const from = list.findIndex((x) => x.id === id)
  if (from < 0) throw new DraftOpError(`Nothing with id ${id} to move`)
  const to = Math.max(0, Math.min(list.length - 1, toIndex))
  if (from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, mark(item))
  return next
}

export function applyHumanOp(draft: Draft, op: HumanOp): Draft {
  if (draft.version === 0) throw new DraftOpError('There is no Draft to edit before v1 is written')
  const section = 'sectionId' in op ? draft.sections.find((s) => s.id === op.sectionId) : undefined
  if ('sectionId' in op && !section) throw new DraftOpError(`No Section ${op.sectionId}`)

  const withSection = (f: (s: Section) => Section): Draft => ({
    ...draft,
    sections: draft.sections.map((s) => (s.id === section!.id ? f(s) : s)),
  })
  const withEntry = (entryId: string, f: (e: Entry) => Entry): Draft => {
    if (!section!.entries.some((e) => e.id === entryId)) throw new DraftOpError(`No Entry ${entryId}`)
    return withSection((s) => ({ ...s, entries: s.entries.map((e) => (e.id === entryId ? f(e) : e)) }))
  }

  let next: Draft
  switch (op.op) {
    case 'retitle':
      if (!op.title.trim()) throw new DraftOpError('A Draft needs a Title')
      next = { ...draft, title: op.title.trim(), titleHumanEdited: true }
      break
    case 'editSection':
      next = withSection((s) => ({ ...s, body: op.body, humanEdited: true }))
      break
    case 'editEntry':
      next = withEntry(op.entryId, (e) => ({ ...e, title: op.title ?? e.title, body: op.body ?? e.body, humanEdited: true }))
      break
    case 'addEntry':
      if (section!.shape !== 'entries') throw new DraftOpError(`"${section!.heading}" holds prose, not Entries`)
      next = withSection((s) => ({ ...s, entries: [...s.entries, { ...newEntry(op.title, op.body), humanEdited: true }] }))
      break
    case 'moveSection':
      next = { ...draft, sections: moveTo(draft.sections, op.sectionId, op.toIndex, (s) => ({ ...s, humanMoved: true })) }
      break
    case 'moveEntry':
      next = withSection((s) => ({ ...s, entries: moveTo(s.entries, op.entryId, op.toIndex, (e) => ({ ...e, humanMoved: true })) }))
      break
    case 'discardSection':
      if (section!.locked) throw new DraftOpError(`"${section!.heading}" is a Locked Section — it can be edited and moved, never Discarded`)
      next = withSection((s) => ({ ...s, discarded: true }))
      break
    case 'restoreSection':
      next = withSection((s) => ({ ...s, discarded: false }))
      break
    case 'discardEntry':
      next = withEntry(op.entryId, (e) => ({ ...e, discarded: true }))
      break
    case 'restoreEntry':
      next = withEntry(op.entryId, (e) => ({ ...e, discarded: false }))
      break
    default:
      throw new DraftOpError(`Unknown edit ${(op as { op?: unknown }).op}`)
  }
  return next
}
