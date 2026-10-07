// Triage: the human accepts or rejects each change; once nothing is pending the Proposal closes and,
// if anything was accepted, the next Iteration is logged.
import type { IterationMeta } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { applyChange } from '#core/proposal/applyChange.ts'
import { reclassify } from '#core/proposal/classify.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
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
  if (proposal.changes.some((c) => c.status === 'pending')) return null
  const accepted = proposal.changes.filter((c) => c.status === 'accepted').length
  let next: Draft = { ...draft, proposal: null }
  if (proposal.upgradeTo) next = adoptTemplate(next, proposal.upgradeTo)
  if (accepted === 0 && !proposal.upgradeTo) return next
  const version = draft.version + 1
  const what = `${accepted} change${accepted === 1 ? '' : 's'} accepted from ${SESSION_NAMES[proposal.kind]}`
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
  const defs = new Map(template.sections.map((d) => [d.key, d]))
  return {
    ...draft,
    template,
    sections: draft.sections.map((s) => {
      const d = defs.get(s.key)
      if (!d) return s
      const { entryFormat: _drop, ...rest } = s
      return {
        ...rest,
        heading: d.heading,
        locked: d.locked,
        target: d.target,
        guidance: d.guidance,
        ...(d.entryFormat ? { entryFormat: d.entryFormat } : {}),
      }
    }),
  }
}

const settle = (draft: Draft, meta: IterationMeta) => finalize(draft, meta) ?? draft

export function decide(draft: Draft, changeId: string, accept: boolean, meta: IterationMeta): Draft {
  const change = draft.proposal?.changes.find((c) => c.id === changeId)
  if (!draft.proposal || !change || change.status !== 'pending') return draft
  const status = accept ? ('accepted' as const) : ('rejected' as const)
  const applied = accept ? applyChange(draft, change) : draft
  const changes = draft.proposal.changes.map((c) => (c.id === changeId ? { ...c, status } : c))
  return settle(reclassify({ ...applied, proposal: { ...draft.proposal, changes } }), meta)
}

export function acceptAllClean(draft: Draft, meta: IterationMeta): Draft {
  if (!draft.proposal) return draft
  let next = draft
  for (const c of draft.proposal.changes) {
    if (c.status === 'pending' && !c.conflict) next = applyChange(next, c)
  }
  const changes = draft.proposal.changes.map((c) =>
    c.status === 'pending' && !c.conflict ? { ...c, status: 'accepted' as const } : c,
  )
  return settle(reclassify({ ...next, proposal: { ...draft.proposal, changes } }), meta)
}
