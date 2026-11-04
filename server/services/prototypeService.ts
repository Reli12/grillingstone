// What removes Prototypes: Delete a finished Prototype, Dismiss a Failed or Stopped session. Each change is
// announced to the browser, so the Draft's and the Project's lists stay in step.
import { LIVE_STATUSES } from '#core/session/sessionTypes.ts'

import type { Hub } from '../hub.ts'
import { Conflict } from '../storage/errors.ts'
import * as prototypes from '../storage/prototypes.ts'

const NOT_DISMISSIBLE = 'Only a Failed or Stopped Prototype Session can be dismissed.'

export class PrototypeService {
  private hub: Hub

  constructor(hub: Hub) {
    this.hub = hub
  }

  /** Deletes the Prototype's files; Prototypes started from it keep working. */
  async delete(projectId: string, prototypeId: string) {
    await prototypes.deletePrototype(projectId, prototypeId)
    this.hub.broadcast({ type: 'prototypes', projectId })
  }

  /** Removes a Failed or Stopped session's record and its extra-Image copies; a running or finished one stays. */
  async dismiss(projectId: string, sessionId: string) {
    const session = await prototypes.getPrototypeSession(projectId, sessionId)
    const ended = !LIVE_STATUSES.includes(session.status) && session.status !== 'finished'
    if (!ended) throw new Conflict(NOT_DISMISSIBLE)
    await prototypes.deletePrototypeSession(projectId, sessionId)
    this.hub.broadcast({ type: 'prototypes', projectId })
  }
}
