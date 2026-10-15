// What a Continuation of an ended Grilling Session becomes on the Draft as it is now (ADR-0014): after v1 it
// can only propose, and it keeps its focus or upgrade only while those still make sense. The conversation belongs
// to the Assistant that held it, so it continues only while Settings still name that Assistant (ADR-0020).
import type { Draft } from '#core/draft/draftTypes.ts'
import { ASSISTANT_LABELS, type AssistantName } from '#core/session/assistantName.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { LIVE_STATUSES, type SessionSummary } from '#core/session/sessionTypes.ts'

export type Continuation =
  { ok: true; kind: SessionKind; focus?: { sectionId: string; entryId?: string } } | { ok: false; reason: string }

/** Why a session cannot be continued while Settings name another Assistant than the one that held it. */
export const heldByOtherAssistant = (holder: AssistantName) =>
  `${ASSISTANT_LABELS[holder]} held this conversation. Switch to ${ASSISTANT_LABELS[holder]} in Settings to continue it, or start a new session.`

export interface ContinuationContext {
  /** The Assistant Settings name now. */
  assistant: AssistantName
  /** The newest version of the Draft's Template, if it still exists. */
  latestTemplateVersion?: number
}

export function continuation(
  earlier: SessionSummary,
  draft: Draft,
  { assistant, latestTemplateVersion }: ContinuationContext,
): Continuation {
  if (LIVE_STATUSES.includes(earlier.status)) return { ok: false, reason: 'This session is still running.' }
  if (!earlier.conversationId)
    return { ok: false, reason: 'This session ran before sessions could be continued — start a new one.' }
  if (earlier.assistant !== assistant) return { ok: false, reason: heldByOtherAssistant(earlier.assistant) }
  if (draft.version === 0) return { ok: true, kind: 'first' }
  if (draft.proposal) return { ok: false, reason: 'Triage the open Proposal before continuing a session.' }

  if (earlier.kind === 'focused' && earlier.focus) {
    const focusedSectionId = earlier.focus.sectionId
    const section = draft.sections.find((candidate) => candidate.id === focusedSectionId && !candidate.discarded)
    const entryId = earlier.focus.entryId
    const entryLive = !entryId || section?.entries.some((entry) => entry.id === entryId && !entry.discarded)
    if (section && entryLive)
      return { ok: true, kind: 'focused', focus: { sectionId: section.id, ...(entryId ? { entryId } : {}) } }
  }
  if (
    earlier.kind === 'upgrade' &&
    latestTemplateVersion !== undefined &&
    latestTemplateVersion > draft.template.version
  )
    return { ok: true, kind: 'upgrade' }
  return { ok: true, kind: 'iteration' }
}
