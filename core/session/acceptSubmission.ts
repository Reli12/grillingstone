// What a Grilling Session's submission does to its Draft (ADR-0004, ADR-0005): the first session writes v1
// once the content passes the Template; a later one opens a Proposal once every change checks out.
import { type IterationMeta, writeV1 } from '#core/draft/draft.ts'
import type { Draft, DraftContent } from '#core/draft/draftTypes.ts'
import { validate } from '#core/draft/draftValidator.ts'
import { checkProposal } from '#core/proposal/checkProposal.ts'
import { openProposal } from '#core/proposal/classify.ts'
import type { ProposedChange } from '#core/proposal/proposalTypes.ts'
import { draftSnapshot } from '#core/publish/publishedSnapshot.ts'
import { type SessionKind, writesV1 } from '#core/session/sessionKind.ts'
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

/**
 * v1, from the first session or an Import Session. An Imported Draft's Published Snapshot then takes v1 as the
 * Draft it was linked with, so Drift later tells the human's own changes from the item's.
 */
function acceptV1(draft: Draft, submission: Submission): SubmissionOutcome {
  if (draft.version !== 0) return { ok: false, reasons: [{ code: 'v1-exists', message: 'v1 already exists.' }] }
  const imported = submission.kind === 'import'
  const result = validate(draft.template, submission.payload as DraftContent, { imported })
  if (!result.ok) return { ok: false, reasons: result.reasons }
  const linked = draft.linkedWorkItem
  const note = imported && linked ? `Imported from Azure DevOps #${linked.id}` : undefined
  const written = writeV1(draft, submission.payload as DraftContent, submission.meta, note)
  const snapshot = imported && draft.publishedSnapshot
  const next = snapshot ? { ...written, publishedSnapshot: { ...snapshot, draft: draftSnapshot(written) } } : written
  return {
    ok: true,
    draft: next,
    message: `Draft v1 written and validated against the ${draft.template.name} (${next.sections.length} Sections).`,
  }
}

export function acceptSubmission(draft: Draft, submission: Submission): SubmissionOutcome {
  if (writesV1(submission.kind)) return acceptV1(draft, submission)
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
