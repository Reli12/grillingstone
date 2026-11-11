// Drift: what someone changed in Azure DevOps since the Published Snapshot, brought back into the Draft as a
// Proposal. Each drifted field is split back along the structure the Publish Renderer wrote — a heading per Section,
// a bold first line per Entry — and compared three ways: Azure DevOps now, Azure DevOps at the last Publish, and the
// Draft. Only what Azure DevOps changed becomes a change; what cannot be placed is reported, never dropped.
import type { DriftSeen, PublishedSnapshot, WorkItemView } from '#core/ado/adoTypes.ts'
import type { Draft, Section } from '#core/draft/draftTypes.ts'
import { classify } from '#core/proposal/classify.ts'
import type { ProposedChange } from '#core/proposal/proposalTypes.ts'
import { sameContent, sameTitle, templateTargets } from '#core/publish/publishedSnapshot.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { blockMarkdown, blocksMarkdown, type HtmlBlock, htmlBlocks } from '#core/shared/htmlMarkdown.ts'
import { newId } from '#core/shared/ids.ts'
import { fieldLabel, JIRA_FIELDS } from '#core/shared/trackerFields.ts'
import { defaultIterationLogTarget } from '#core/shared/workItemType.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

/** Description fields carry many Sections, so the Renderer writes each one's heading there (as publishRenderer.ts). */
const DESCRIPTION_FIELDS: string[] = [ADO_FIELDS.description, JIRA_FIELDS.description]
// An Entry's first line as the Renderer writes it: the title in bold, alone.
const ENTRY_TITLE = /^\*\*(.+)\*\*$/
// A Gherkin keyword the Renderer bolded at the start of an Entry line.
const BOLD_KEYWORD = /^\*\*(Given|When|Then|And|But)\*\*/

/** The newest Azure DevOps state the Draft knows about: the last Drift brought in, else the last Publish. */
export const driftBaselineRev = (draft: Draft): number | null =>
  draft.driftSeen?.rev ?? draft.publishedSnapshot?.rev ?? null

/** The Linked Work Item has a newer revision than the Draft knows: it may have Drift (only a Drift Check says). */
export function mayHaveDrift(draft: Draft, currentRev: number): boolean {
  const known = driftBaselineRev(draft)
  return known !== null && currentRev > known
}

interface SplitEntry {
  title: string
  body: string
}

/** One Section's content inside a field: prose, or Entries. */
interface Part {
  body: string
  entries: SplitEntry[] | null
}

interface Split {
  /** Section id → its content. */
  parts: Map<string, Part>
  /** Content that belongs to no Section, as markdown. */
  unplaced: string[]
}

function entryOf(block: HtmlBlock): SplitEntry | null {
  if (block.kind !== 'paragraph') return null
  const title = ENTRY_TITLE.exec(block.lines[0])?.[1]
  if (!title) return null
  const body = block.lines.slice(1).map((line) => line.replace(BOLD_KEYWORD, '$1'))
  return { title: title.trim(), body: body.join('\n') }
}

/** A Section's blocks as prose, or as Entries when it is an Entries Section written as Entries. */
function partOf(section: Section, blocks: HtmlBlock[], unplaced: string[]): Part {
  const prose: Part = { body: blocksMarkdown(blocks), entries: null }
  if (section.shape !== 'entries' || !blocks.some((block) => entryOf(block))) return prose
  const entries: SplitEntry[] = []
  for (const block of blocks) {
    const entry = entryOf(block)
    if (entry) entries.push(entry)
    // A line added as its own paragraph belongs to the Entry above it.
    else if (entries.length) entries[entries.length - 1].body += `\n${blockMarkdown(block)}`.replace(/^\n/, '')
    else unplaced.push(`${section.heading}: ${blockMarkdown(block)}`)
  }
  return { body: '', entries }
}

/** Drops the Iteration Log the tool appends: it is the tool's own, never a Section. */
function withoutIterationLog(draft: Draft, field: string, blocks: HtmlBlock[]): HtmlBlock[] {
  const template = draft.template
  const logTarget =
    template.iterationLogTarget ?? defaultIterationLogTarget(templateTracker(template), draft.workItemType)
  if (field !== logTarget) return blocks
  const at = blocks.findIndex(
    (block) =>
      block.kind === 'heading' && block.text.trim().toLowerCase() === template.iterationLogHeading.trim().toLowerCase(),
  )
  if (at < 0) return blocks
  const next = blocks.findIndex((block, index) => index > at && block.kind === 'heading')
  return [...blocks.slice(0, at), ...(next < 0 ? [] : blocks.slice(next))]
}

const sameHeading = (first: string, second: string) => first.trim().toLowerCase() === second.trim().toLowerCase()

/** One field's HTML split back into the Draft's Sections that target it. */
export function splitField(draft: Draft, field: string, html: string): Split {
  const blocks = withoutIterationLog(draft, field, htmlBlocks(html))
  const sections = draft.sections.filter((section) => section.target === field)
  const published = sections.filter((section) => !section.discarded)
  const parts = new Map<string, Part>()
  const unplaced: string[] = []
  const withHeadings = DESCRIPTION_FIELDS.includes(field) || published.length > 1

  if (!withHeadings) {
    if (published.length === 1) parts.set(published[0].id, partOf(published[0], blocks, unplaced))
    else if (blocks.length) unplaced.push(blocksMarkdown(blocks))
    return { parts, unplaced }
  }

  let current: { section: Section | null; heading: string; blocks: HtmlBlock[] } | null = null
  const close = () => {
    if (!current) return
    if (current.section) parts.set(current.section.id, partOf(current.section, current.blocks, unplaced))
    else unplaced.push([`## ${current.heading}`, ...current.blocks.map(blockMarkdown)].join('\n\n'))
  }
  for (const block of blocks) {
    if (block.kind === 'heading') {
      close()
      const section = sections.find((candidate) => sameHeading(candidate.heading, block.text)) ?? null
      current = { section, heading: block.text, blocks: [] }
    } else if (current) current.blocks.push(block)
    else unplaced.push(blockMarkdown(block))
  }
  close()
  return { parts, unplaced }
}

const entryText = (entry: SplitEntry) => `${entry.title}\n${entry.body}`.trim()
const sameEntry = (first: SplitEntry, second: SplitEntry) => entryText(first) === entryText(second)

/** Pairs Azure DevOps' Entries with the baseline's: by title first, then the rest in order. */
function alignEntries(now: SplitEntry[], base: SplitEntry[]): { pairs: [number, number | null][]; removed: number[] } {
  const matched = new Map<number, number>()
  const used = new Set<number>()
  now.forEach((entry, index) => {
    const found = base.findIndex((candidate, at) => !used.has(at) && sameHeading(candidate.title, entry.title))
    if (found >= 0) {
      matched.set(index, found)
      used.add(found)
    }
  })
  const leftoverBase = base.map((_, at) => at).filter((at) => !used.has(at))
  now.forEach((_, index) => {
    if (matched.has(index) || !leftoverBase.length) return
    const at = leftoverBase.shift()!
    matched.set(index, at)
    used.add(at)
  })
  const pairs = now.map((_, index): [number, number | null] => [index, matched.get(index) ?? null])
  return { pairs, removed: base.map((_, at) => at).filter((at) => !used.has(at)) }
}

/** The Draft Entry a baseline Entry was rendered from: same position when the counts agree, else same title. */
function draftEntryId(snapshot: PublishedSnapshot, section: Section, base: SplitEntry[], at: number): string | null {
  const published = snapshot.draft.sections.find((candidate) => candidate.id === section.id)?.entries ?? []
  const id =
    published.length === base.length
      ? published[at]?.id
      : published.find((entry) => sameHeading(entry.title, base[at].title))?.id
  return id && section.entries.some((entry) => entry.id === id) ? id : null
}

interface FieldDrift {
  changes: ProposedChange[]
  notes: string[]
}

interface Sides {
  now: Part | undefined
  base: Part | undefined
  seen: Part | undefined
  /** An earlier Drift Check was brought in: what it saw is not reported again. */
  hasSeen: boolean
}

function proseChange(section: Section, sides: Sides): ProposedChange[] {
  const body = sides.now?.body ?? ''
  if (body === (sides.base?.body ?? '') || (sides.seen && body === sides.seen.body)) return []
  return [
    { kind: 'replaceSection', sectionId: section.id, body, label: `${section.heading} · changed in Azure DevOps` },
  ]
}

function entryChanges(section: Section, sides: Sides, snapshot: PublishedSnapshot, field: string): FieldDrift {
  const now = sides.now?.entries ?? []
  const base = sides.base?.entries ?? []
  const seen = sides.seen?.entries ?? null
  const seenAlready = (entry: SplitEntry) => seen?.some((candidate) => sameEntry(candidate, entry)) ?? false
  const { pairs, removed } = alignEntries(now, base)
  const changes: ProposedChange[] = []
  let previousId: string | undefined
  for (const [index, at] of pairs) {
    const entry = now[index]
    const id = at === null ? null : draftEntryId(snapshot, section, base, at)
    const unchanged = at !== null && sameEntry(entry, base[at])
    if (!unchanged && !seenAlready(entry)) {
      const label = `${section.heading} · “${entry.title}” changed in Azure DevOps`
      if (id) changes.push({ kind: 'replaceEntry', sectionId: section.id, entryId: id, ...entry, label })
      else
        changes.push({
          kind: 'addEntry',
          sectionId: section.id,
          ...entry,
          ...(previousId ? { afterEntryId: previousId } : {}),
          label: `${section.heading} · “${entry.title}” added in Azure DevOps`,
        })
    }
    previousId = id ?? previousId
  }
  // An Entry an earlier Drift Check already reported as removed is not reported again.
  const notes = removed
    .filter((at) => !seen || seen.some((candidate) => sameEntry(candidate, base[at])))
    .map((at) => `“${base[at].title}” (${section.heading}) was removed from ${fieldLabel(field)} in Azure DevOps.`)
  return { changes, notes }
}

function sectionDrift(section: Section, sides: Sides, snapshot: PublishedSnapshot, field: string): FieldDrift {
  if (!sides.now && !sides.base) return { changes: [], notes: [] }
  if (!sides.now) {
    const reportedAlready = sides.hasSeen && !sides.seen
    if (reportedAlready || section.discarded) return { changes: [], notes: [] }
    return { changes: [], notes: [`“${section.heading}” was removed from ${fieldLabel(field)} in Azure DevOps.`] }
  }
  const restore: ProposedChange[] =
    section.discarded && !sides.base
      ? [{ kind: 'restore', sectionId: section.id, label: `${section.heading} · back in Azure DevOps` }]
      : []
  const asEntries = section.shape === 'entries' && (sides.now.entries !== null || sides.base?.entries)
  if (!asEntries) return { changes: [...restore, ...proseChange(section, sides)], notes: [] }
  const drift = entryChanges(section, sides, snapshot, field)
  return { changes: [...restore, ...drift.changes], notes: drift.notes }
}

/** The changes Azure DevOps made to one field, as Proposal changes and notes. */
function fieldDrift(draft: Draft, field: string, item: WorkItemView, seen: DriftSeen | undefined): FieldDrift {
  const snapshot = draft.publishedSnapshot!
  const now = splitField(draft, field, item.fields[field] ?? '')
  const base = splitField(draft, field, snapshot.fields[field] ?? '')
  const seenSplit = seen ? splitField(draft, field, seen.fields[field] ?? '') : null
  const changes: ProposedChange[] = []
  const notes: string[] = []
  for (const section of draft.sections.filter((candidate) => candidate.target === field)) {
    const sides: Sides = {
      now: now.parts.get(section.id),
      base: base.parts.get(section.id),
      seen: seenSplit?.parts.get(section.id),
      hasSeen: seenSplit !== null,
    }
    const drift = sectionDrift(section, sides, snapshot, field)
    changes.push(...drift.changes)
    notes.push(...drift.notes)
  }
  const knownUnplaced = new Set([...base.unplaced, ...(seenSplit?.unplaced ?? [])])
  for (const text of now.unplaced.filter((candidate) => !knownUnplaced.has(candidate)))
    notes.push(`Not placed in any Section (${fieldLabel(field)}): ${text}`)
  return { changes, notes }
}

/** The Template's fields where Azure DevOps differs from what the Draft last knew; "System.Title" for the title. */
export function driftedFields(draft: Draft, item: WorkItemView): string[] {
  const snapshot = draft.publishedSnapshot
  if (!snapshot) return []
  const known = draft.driftSeen ?? snapshot
  const fields = templateTargets(draft).filter((field) => !sameContent(item.fields[field], known.fields[field]))
  return sameTitle(item.title, known.title) ? fields : [ADO_FIELDS.title, ...fields]
}

export interface DriftResult {
  changes: ProposedChange[]
  notes: string[]
  /** Labels of the fields that drifted. */
  fields: string[]
}

/** Everything Azure DevOps changed since the Draft last knew, as Proposal changes and notes. */
export function detectDrift(draft: Draft, item: WorkItemView): DriftResult {
  const snapshot = draft.publishedSnapshot
  if (!snapshot) return { changes: [], notes: [], fields: [] }
  const fields = driftedFields(draft, item)
  const seen = draft.driftSeen
  const changes: ProposedChange[] = []
  const notes: string[] = []
  for (const field of fields) {
    if (field === ADO_FIELDS.title) {
      if (!sameTitle(item.title, snapshot.title))
        changes.push({ kind: 'retitle', title: item.title.trim(), label: 'Title · changed in Azure DevOps' })
      continue
    }
    const drift = fieldDrift(draft, field, item, seen)
    changes.push(...drift.changes)
    notes.push(...drift.notes)
  }
  return { changes, notes, fields: fields.map(fieldLabel) }
}

/**
 * The Draft after a Drift Check against `item`: a Proposal from Drift when Azure DevOps changed anything placeable,
 * and in every case the item's state recorded as seen, so the same changes are not brought in twice.
 * A Draft with an open Proposal gets no second one: the caller refuses first.
 */
export function bringInDrift(draft: Draft, item: WorkItemView, now: string): { draft: Draft; drift: DriftResult } {
  const drift = detectDrift(draft, item)
  const seen: DriftSeen = {
    rev: item.rev,
    title: item.title,
    fields: Object.fromEntries(templateTargets(draft).map((f) => [f, item.fields[f] ?? ''])),
  }
  if (!drift.changes.length || draft.proposal || draft.version === 0)
    return { draft: { ...draft, driftSeen: seen }, drift }
  const withSeen = { ...draft, driftSeen: seen }
  const proposal = {
    id: newId('p'),
    sessionId: newId('drift'),
    kind: 'drift' as const,
    createdAt: now,
    changes: classify(withSeen, drift.changes, 'drift'),
    ...(drift.notes.length ? { notes: drift.notes } : {}),
  }
  return { draft: { ...withSeen, proposal }, drift }
}
