// A refusal of an Azure DevOps action with every reason it was refused, answered as 422 so the browser can show
// each one (a Publish blocked for three reasons shows all three).
import type { Reason } from '#core/shared/validation.ts'

export class AdoRefusal extends Error {
  reasons: Reason[]
  /** A Draft the refusal points to (e.g. the one already linked to the item), for "open it". */
  draftId?: string

  constructor(reasons: Reason[] | string, draftId?: string) {
    const list = typeof reasons === 'string' ? [{ code: 'refused', message: reasons }] : reasons
    super(list.map((reason) => reason.message).join(' '))
    this.reasons = list
    if (draftId) this.draftId = draftId
  }
}
