// What a Continuation of an ended Grilling Session becomes on the Draft as it is now (ADR-0014): after v1 it
// can only propose, and it keeps its focus or upgrade only while those still make sense.
import type { Draft } from '#core/draft/draftTypes.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { LIVE_STATUSES, type SessionSummary } from '#core/session/sessionTypes.ts'

export type Continuation = { ok: true; kind: SessionKind; focus?: { sectionId: string; entryId?: string } } | { ok: false; reason: string }

/** `latestTemplateVersion` is the newest version of the Draft's Template, if it still exists. */
export function continuation(earlier: SessionSummary, draft: Draft, latestTemplateVersion: number | undefined): Continuation {
  if (LIVE_STATUSES.includes(earlier.status)) return { ok: false, reason: 'This session is still running.' }
  if (!earlier.claudeSessionId) return { ok: false, reason: 'This session ran before sessions could be continued — start a new one.' }
  if (draft.version === 0) return { ok: true, kind: 'first' }
  if (draft.proposal) return { ok: false, reason: 'Triage the open Proposal before continuing a session.' }

  if (earlier.kind === 'focused' && earlier.focus) {
    const section = draft.sections.find((s) => s.id === earlier.focus!.sectionId && !s.discarded)
    const entryId = earlier.focus.entryId
    const entryLive = !entryId || section?.entries.some((e) => e.id === entryId && !e.discarded)
    if (section && entryLive) return { ok: true, kind: 'focused', focus: { sectionId: section.id, ...(entryId ? { entryId } : {}) } }
  }
  if (earlier.kind === 'upgrade' && latestTemplateVersion !== undefined && latestTemplateVersion > draft.template.version) return { ok: true, kind: 'upgrade' }
  return { ok: true, kind: 'iteration' }
}
