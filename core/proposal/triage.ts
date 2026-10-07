// Triage: the human accepts or rejects each change; once nothing is pending the Proposal closes and,
// if anything was accepted, the next Iteration is logged.
import type { IterationMeta } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { applyChange } from '#core/proposal/applyChange.ts'
import { reclassify } from '#core/proposal/classify.ts'
import type { Change } from '#core/proposal/proposalTypes.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { plural } from '#core/shared/plural.ts'
import type { Template } from '#core/template/templateTypes.ts'

const SESSION_NAMES: Record<SessionKind, string> = {
  first: 'the first session',
  focused: 'a Focused Session',
  iteration: 'an Iteration session',
  upgrade: 'a Template upgrade',
}

/** Closes a fully triaged Proposal: the next Iteration if anything was accepted. Null while changes are pending. */
export function finalize(draft: Draft, meta: IterationMeta): Draft | null {
  const proposal = draft.proposal
  if (!proposal) return draft
  if (proposal.changes.some((change) => change.status === 'pending')) return null
  const accepted = proposal.changes.filter((change) => change.status === 'accepted').length
  let next: Draft = { ...draft, proposal: null }
  if (proposal.upgradeTo) next = adoptTemplate(next, proposal.upgradeTo)
  if (accepted === 0 && !proposal.upgradeTo) return next
  const version = draft.version + 1
  const what = `${plural(accepted, 'change')} accepted from ${SESSION_NAMES[proposal.kind]}`
  const note = proposal.upgradeTo
    ? `Upgraded to ${proposal.upgradeTo.name} v${proposal.upgradeTo.version}; ${what}`
    : what
  return {
    ...next,
    version,
    iterationLog: [...draft.iterationLog, { version, date: meta.date, author: meta.author, note }],
    updatedAt: meta.date,
  }
}

/** A Template upgrade keeps the human's order and content but takes headings, locks and targets from the new version. */
function adoptTemplate(draft: Draft, template: Template): Draft {
  const defs = new Map(template.sections.map((def) => [def.key, def]))
  return {
    ...draft,
    template,
    sections: draft.sections.map((section) => {
      const def = defs.get(section.key)
      if (!def) return section
      const { entryFormat: _drop, ...rest } = section
      return {
        ...rest,
        heading: def.heading,
        locked: def.locked,
        target: def.target,
        guidance: def.guidance,
        ...(def.entryFormat ? { entryFormat: def.entryFormat } : {}),
      }
    }),
  }
}

const settle = (draft: Draft, meta: IterationMeta) => finalize(draft, meta) ?? draft

export function decide(draft: Draft, changeId: string, accept: boolean, meta: IterationMeta): Draft {
  const change = draft.proposal?.changes.find((candidate) => candidate.id === changeId)
  if (!draft.proposal || !change || change.status !== 'pending') return draft
  const status = accept ? ('accepted' as const) : ('rejected' as const)
  const applied = accept ? applyChange(draft, change) : draft
  const changes = draft.proposal.changes.map((other) => (other.id === changeId ? { ...other, status } : other))
  return settle(reclassify({ ...applied, proposal: { ...draft.proposal, changes } }), meta)
}

export function acceptAllClean(draft: Draft, meta: IterationMeta): Draft {
  if (!draft.proposal) return draft
  let next = draft
  const isPendingClean = (change: Change) => change.status === 'pending' && !change.conflict
  for (const change of draft.proposal.changes) {
    if (isPendingClean(change)) next = applyChange(next, change)
  }
  const changes = draft.proposal.changes.map((change) =>
    isPendingClean(change) ? { ...change, status: 'accepted' as const } : change,
  )
  return settle(reclassify({ ...next, proposal: { ...draft.proposal, changes } }), meta)
}
