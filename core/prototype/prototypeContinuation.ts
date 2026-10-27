// What a Continuation of an ended Prototype Grilling Session becomes (ADR-0014, ADR-0024): a new session that resumes
// Claude Code's conversation, starts from the session's newest Prototype that still exists, and labels what it writes
// with the Draft's version as it is now.
import type { PrototypeDraftLink } from '#core/prototype/prototypeRecords.ts'
import { NOT_CONTINUABLE, STILL_RUNNING } from '#core/session/continuation.ts'
import { LIVE_STATUSES, type SessionStatus } from '#core/session/sessionTypes.ts'

export const ALREADY_WRITING_PROTOTYPE = 'A Prototype is already being written for this Draft.'
export const DRAFT_GONE = 'The Draft this session started from no longer exists.'

export interface PrototypeGrillingContinuationRequest {
  earlier: {
    status: SessionStatus
    claudeSessionId?: string
    /** The Draft it started from and that Draft's version then. */
    draft?: PrototypeDraftLink
    /** The Prototypes it wrote, oldest round first. */
    prototypeIds: readonly string[]
    /** The Prototype it started from. */
    startingPrototypeId?: string
  }
  /** The version of the Draft the earlier session started from, as it is now; absent if there was none or it is gone. */
  currentDraftVersion?: number
  /** The ids of the Prototypes that still exist. */
  surviving: readonly string[]
  /** Another Prototype-writing session runs on that Draft (or is being started on it). */
  lockHeld: boolean
}

export type PrototypeGrillingContinuation =
  { ok: true; draft?: PrototypeDraftLink; startingPrototypeId?: string } | { ok: false; reason: string }

/** The newest Prototype of the session that survives; else the one it started from, if that survives; else none. */
function startingPrototypeOf({ earlier, surviving }: PrototypeGrillingContinuationRequest): string | undefined {
  const exists = (id: string) => surviving.includes(id)
  const newest = [...earlier.prototypeIds].reverse().find(exists)
  if (newest) return newest
  return earlier.startingPrototypeId !== undefined && exists(earlier.startingPrototypeId)
    ? earlier.startingPrototypeId
    : undefined
}

export function prototypeGrillingContinuation(
  request: PrototypeGrillingContinuationRequest,
): PrototypeGrillingContinuation {
  const { earlier, currentDraftVersion, lockHeld } = request
  if (LIVE_STATUSES.includes(earlier.status)) return { ok: false, reason: STILL_RUNNING }
  if (!earlier.claudeSessionId) return { ok: false, reason: NOT_CONTINUABLE }
  let draft: PrototypeDraftLink | undefined
  if (earlier.draft) {
    if (currentDraftVersion === undefined) return { ok: false, reason: DRAFT_GONE }
    if (lockHeld) return { ok: false, reason: ALREADY_WRITING_PROTOTYPE }
    draft = { draftId: earlier.draft.draftId, draftVersion: currentDraftVersion }
  }
  const startingPrototypeId = startingPrototypeOf(request)
  return {
    ok: true,
    ...(draft ? { draft } : {}),
    ...(startingPrototypeId ? { startingPrototypeId } : {}),
  }
}
