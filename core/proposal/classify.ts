// Classifying a Proposal's changes (ADR-0005): whether a change is a Conflict is derived from what the
// human did to its target — never declared by Claude.
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'
import type { Change, ProposedChange } from '#core/proposal/proposalTypes.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { newId } from '#core/shared/ids.ts'
import type { Template } from '#core/template/templateTypes.ts'

const entryText = (e: { title: string; body: string }) => `${e.title}\n${e.body}`

interface Target {
  section?: Section
  entry?: Entry
}

const findTarget = (draft: Draft, p: ProposedChange): Target => {
  const section = draft.sections.find((s) => s.id === p.sectionId)
  const entry = section?.entries.find((e) => e.id === p.entryId)
  return { section, entry }
}

/** Why this change needs the human's individual decision, or undefined for a Clean Change. */
function conflictReason(draft: Draft, p: ProposedChange, { section, entry }: Target): string | undefined {
  switch (p.kind) {
    case 'retitle':
      return draft.titleHumanEdited ? 'You retitled this Draft' : undefined
    case 'restore':
      return (entry ?? section)?.discarded ? 'You discarded this' : undefined
    case 'addSection':
      return undefined
    case 'addEntry':
      return section?.discarded ? 'You discarded this Section' : undefined
    case 'replaceSection':
    case 'replaceEntry': {
      const target = p.kind === 'replaceEntry' ? entry : section
      if (target?.discarded) return 'You discarded this'
      if (p.kind === 'replaceEntry' && section?.discarded) return 'You discarded this Section'
      if (target?.humanEdited) return 'You hand-edited this'
      if (target?.humanMoved) return 'You moved this'
      return undefined
    }
  }
}

function describe(draft: Draft, p: ProposedChange, { section, entry }: Target): Pick<Change, 'label' | 'before' | 'after'> {
  const heading = section?.heading ?? draft.template.sections.find((d) => d.key === p.sectionKey)?.heading ?? 'Draft'
  const label = (verb: string) => p.label?.trim() || `${heading} · ${verb}`
  switch (p.kind) {
    case 'retitle':
      return { label: p.label?.trim() || 'Title · reword', before: draft.title, after: p.title ?? '' }
    case 'replaceSection':
      return { label: label('rewrite'), before: section?.body, after: p.body ?? '' }
    case 'replaceEntry':
      return {
        label: label(`rewrite "${entry?.title ?? '?'}"`),
        before: entry && entryText(entry),
        after: entryText({ title: p.title ?? entry?.title ?? '', body: p.body ?? '' }),
      }
    case 'addEntry':
      return { label: label('add Entry'), after: entryText({ title: p.title ?? '', body: p.body ?? '' }) }
    case 'restore': {
      const current = entry ? entryText(entry) : section?.body
      const after = p.body || p.title ? entryText({ title: p.title ?? entry?.title ?? '', body: p.body ?? '' }) : (current ?? '')
      return { label: label(`bring back${entry ? ` "${entry.title}"` : ''}`), before: '(Discarded by you)', after }
    }
    case 'addSection': {
      const after = p.entries?.length ? p.entries.map(entryText).join('\n\n') : (p.body ?? '')
      return { label: label('add Section'), after }
    }
  }
}

function classifyOne(draft: Draft, p: ProposedChange, id: string, status: Change['status']): Change {
  const target = findTarget(draft, p)
  const reason = conflictReason(draft, p, target)
  const { label, before, after } = describe(draft, p, target)
  const change: Change = { ...stripDerived(p), id, label, after, conflict: reason !== undefined, status }
  if (before !== undefined) change.before = before
  if (reason) change.conflictReason = reason
  return change
}

const stripDerived = (p: ProposedChange): ProposedChange => {
  const { kind, sectionId, entryId, afterEntryId, sectionKey, title, body, entries, label } = p
  return Object.fromEntries(
    Object.entries({ kind, label, sectionId, entryId, afterEntryId, sectionKey, title, body, entries }).filter(([, v]) => v !== undefined),
  ) as unknown as ProposedChange
}

export function classify(draft: Draft, proposed: ProposedChange[]): Change[] {
  return proposed.map((p) => classifyOne(draft, p, newId('c'), 'pending'))
}

/** Re-derives Conflicts for pending changes after the human edited the Draft mid-triage. */
export function reclassify(draft: Draft): Draft {
  if (!draft.proposal) return draft
  const changes = draft.proposal.changes.map((c) => (c.status === 'pending' ? classifyOne(draft, c, c.id, c.status) : c))
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
