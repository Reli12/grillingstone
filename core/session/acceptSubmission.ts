// What a Grilling Session's submission does to its Draft (ADR-0004, ADR-0005): the first session writes v1
// once the content passes the Template; a later one opens a Proposal once every change checks out.
import { type IterationMeta, writeV1 } from '#core/draft/draft.ts'
import type { Draft, DraftContent } from '#core/draft/draftTypes.ts'
import { validate } from '#core/draft/draftValidator.ts'
import { checkProposal } from '#core/proposal/checkProposal.ts'
import { openProposal } from '#core/proposal/classify.ts'
import type { ProposedChange } from '#core/proposal/proposalTypes.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { plural } from '#core/shared/plural.ts'
import type { Reason } from '#core/shared/validation.ts'
import type { Template } from '#core/template/templateTypes.ts'

export interface Submission {
  kind: SessionKind
  sessionId: string
  /** The JSON the session piped into the submit script. */
  payload: unknown
  /** For a Template upgrade: the version the result must satisfy. */
  upgradeTo?: Template
  meta: IterationMeta
  now: string
}

export type SubmissionOutcome = { ok: true; draft: Draft; message: string } | { ok: false; reasons: Reason[] }

export function acceptSubmission(draft: Draft, submission: Submission): SubmissionOutcome {
  if (submission.kind === 'first') {
    if (draft.version !== 0) return { ok: false, reasons: [{ code: 'v1-exists', message: 'v1 already exists.' }] }
    const result = validate(draft.template, submission.payload as DraftContent)
    if (!result.ok) return { ok: false, reasons: result.reasons }
    const next = writeV1(draft, submission.payload as DraftContent, submission.meta)
    return {
      ok: true,
      draft: next,
      message: `Draft v1 written and validated against the ${draft.template.name} (${next.sections.length} Sections).`,
    }
  }
  if (draft.proposal)
    return { ok: false, reasons: [{ code: 'proposal-open', message: 'The Draft already has an open Proposal.' }] }
  const changes = (submission.payload as { changes?: unknown } | null)?.changes
  const reasons = checkProposal(draft, changes, submission.upgradeTo ?? draft.template)
  if (reasons.length) return { ok: false, reasons }
  const next = openProposal(draft, changes as ProposedChange[], {
    sessionId: submission.sessionId,
    kind: submission.kind,
    now: submission.now,
    upgradeTo: submission.upgradeTo,
  })
  const proposed = next.proposal!.changes
  const conflicts = proposed.filter((change) => change.conflict).length
  const clean = proposed.length - conflicts
  return {
    ok: true,
    draft: next,
    message: `Proposal written: ${plural(clean, 'Clean Change')}, ${plural(conflicts, 'Conflict')}.`,
  }
}
