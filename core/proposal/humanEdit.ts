import type { Draft } from '#core/draft/draftTypes.ts'
import { applyHumanOp, type HumanOp } from '#core/draft/humanOps.ts'
import { reclassify } from '#core/proposal/classify.ts'

/** A human edit to a Draft that may have an open Proposal: its pending changes are re-classified, so a
 *  Clean Change whose target the human just edited becomes a Conflict. */
export const applyHumanEdit = (draft: Draft, op: HumanOp): Draft => reclassify(applyHumanOp(draft, op))
