// Classifying a Proposal's changes (ADR-0005): whether a change is a Conflict is derived from what the
// human did to its target — never declared by Claude.
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'
import type { Change, ProposedChange } from '#core/proposal/proposalTypes.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { newId } from '#core/shared/ids.ts'
import type { Template } from '#core/template/templateTypes.ts'

const entryText = (entry: { title: string; body: string }) => `${entry.title}\n${entry.body}`

interface Target {
  section?: Section
  entry?: Entry
}

const findTarget = (draft: Draft, proposed: ProposedChange): Target => {
  const section = draft.sections.find((candidate) => candidate.id === proposed.sectionId)
  const entry = section?.entries.find((candidate) => candidate.id === proposed.entryId)
  return { section, entry }
}

/** A rewrite conflicts when the human discarded, hand-edited or moved what it rewrites. */
function replaceConflict(kind: 'replaceSection' | 'replaceEntry', { section, entry }: Target): string | undefined {
  const target = kind === 'replaceEntry' ? entry : section
  if (target?.discarded) return 'You discarded this'
  if (kind === 'replaceEntry' && section?.discarded) return 'You discarded this Section'
  if (target?.humanEdited) return 'You hand-edited this'
  if (target?.humanMoved) return 'You moved this'
  return undefined
}

/** Why this change needs the human's individual decision, or undefined for a Clean Change. */
function conflictReason(draft: Draft, proposed: ProposedChange, target: Target): string | undefined {
  const { section, entry } = target
  switch (proposed.kind) {
    case 'retitle':
      return draft.titleHumanEdited ? 'You retitled this Draft' : undefined
    case 'restore':
      return (entry ?? section)?.discarded ? 'You discarded this' : undefined
    case 'addSection':
      return undefined
    case 'addEntry':
      return section?.discarded ? 'You discarded this Section' : undefined
    case 'replaceSection':
    case 'replaceEntry':
      return replaceConflict(proposed.kind, target)
  }
}

/** The heading a change is shown under: its Section's, the Template Section it adds, or the Draft itself. */
function targetHeading(draft: Draft, proposed: ProposedChange, section: Section | undefined): string {
  if (section) return section.heading
  const added = draft.template.sections.find((def) => def.key === proposed.sectionKey)
  return added?.heading ?? 'Draft'
}

/** What a restore brings back: the text it supplies, or else what is there now. */
function restoredText(proposed: ProposedChange, { section, entry }: Target): string {
  if (proposed.body || proposed.title) {
    const title = proposed.title ?? entry?.title ?? ''
    return entryText({ title, body: proposed.body ?? '' })
  }
  const current = entry ? entryText(entry) : section?.body
  return current ?? ''
}

function describe(draft: Draft, proposed: ProposedChange, target: Target): Pick<Change, 'label' | 'before' | 'after'> {
  const { section, entry } = target
  const heading = targetHeading(draft, proposed, section)
  const label = (verb: string) => proposed.label?.trim() || `${heading} · ${verb}`
  switch (proposed.kind) {
    case 'retitle':
      return { label: proposed.label?.trim() || 'Title · reword', before: draft.title, after: proposed.title ?? '' }
    case 'replaceSection':
      return { label: label('rewrite'), before: section?.body, after: proposed.body ?? '' }
    case 'replaceEntry': {
      const title = proposed.title ?? entry?.title ?? ''
      return {
        label: label(`rewrite "${entry?.title ?? '?'}"`),
        before: entry && entryText(entry),
        after: entryText({ title, body: proposed.body ?? '' }),
      }
    }
    case 'addEntry':
      return {
        label: label('add Entry'),
        after: entryText({ title: proposed.title ?? '', body: proposed.body ?? '' }),
      }
    case 'restore': {
      const entryName = entry ? ` "${entry.title}"` : ''
      const after = restoredText(proposed, target)
      return { label: label(`bring back${entryName}`), before: '(Discarded by you)', after }
    }
    case 'addSection': {
      const after = proposed.entries?.length ? proposed.entries.map(entryText).join('\n\n') : (proposed.body ?? '')
      return { label: label('add Section'), after }
    }
  }
}

/** Only the fields a session proposes, without undefined keys; drops what classifying derived before. */
const stripDerived = (proposed: ProposedChange): ProposedChange => {
  const { kind, sectionId, entryId, afterEntryId, sectionKey, title, body, entries, label } = proposed
  const fields = { kind, label, sectionId, entryId, afterEntryId, sectionKey, title, body, entries }
  const defined = Object.entries(fields).filter(([, value]) => value !== undefined)
  return Object.fromEntries(defined) as unknown as ProposedChange
}

function classifyOne(draft: Draft, proposed: ProposedChange, id: string, status: Change['status']): Change {
  const target = findTarget(draft, proposed)
  const reason = conflictReason(draft, proposed, target)
  const { label, before, after } = describe(draft, proposed, target)
  const change: Change = { ...stripDerived(proposed), id, label, after, conflict: reason !== undefined, status }
  if (before !== undefined) change.before = before
  if (reason) change.conflictReason = reason
  return change
}

export function classify(draft: Draft, proposed: ProposedChange[]): Change[] {
  return proposed.map((change) => classifyOne(draft, change, newId('c'), 'pending'))
}

/** Re-derives Conflicts for pending changes after the human edited the Draft mid-triage. */
export function reclassify(draft: Draft): Draft {
  if (!draft.proposal) return draft
  const changes = draft.proposal.changes.map((change) =>
    change.status === 'pending' ? classifyOne(draft, change, change.id, change.status) : change,
  )
  return { ...draft, proposal: { ...draft.proposal, changes } }
}
export function openProposal(
  draft: Draft,
  proposed: ProposedChange[],
  opts: { sessionId: string; kind: SessionKind; now: string; upgradeTo?: Template },
): Draft {
  if (draft.version === 0) throw new Error('The first session writes v1 directly; Proposals start after v1')
  return {
    ...draft,
    proposal: {
      id: newId('p'),
      sessionId: opts.sessionId,
      kind: opts.kind,
      createdAt: opts.now,
      changes: classify(draft, proposed),
      ...(opts.upgradeTo ? { upgradeTo: opts.upgradeTo } : {}),
    },
  }
}
