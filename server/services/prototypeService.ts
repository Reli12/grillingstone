// What removes Prototypes: Delete a finished Prototype, Dismiss a Failed or Stopped session. Each change is
// announced to the browser, so the Draft's and the Project's lists stay in step.
import { LIVE_STATUSES } from '#core/session/sessionTypes.ts'

import type { Hub } from '../hub.ts'
import { Conflict } from '../storage/errors.ts'
import * as prototypes from '../storage/prototypes.ts'

const NOT_DISMISSIBLE = 'Only a Failed or Stopped Prototype Session can be dismissed.'
const GRILLING_HAS_DRAFT = 'A session that started from a Draft is deleted with that Draft.'
const GRILLING_RUNNING = 'End the session first.'

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

  /**
   * Deletes an ended Prototype Grilling Session that started from no Draft: its record and Transcript, its Images and
   * every Prototype it wrote. One with a Draft goes only with the Draft; a live one is stopped or ended first.
   */
  async deleteGrillingSession(projectId: string, sessionId: string) {
    const session = await prototypes.getPrototypeGrillingSession(projectId, sessionId)
    if (session.draft) throw new Conflict(GRILLING_HAS_DRAFT)
    if (LIVE_STATUSES.includes(session.status)) throw new Conflict(GRILLING_RUNNING)
    const written = (await prototypes.listPrototypes(projectId)).filter(
      (prototype) => prototype.writtenBy.kind === 'prototypeGrilling' && prototype.writtenBy.sessionId === sessionId,
    )
    for (const prototype of written) await prototypes.deletePrototype(projectId, prototype.id)
    await prototypes.deletePrototypeGrillingSession(projectId, sessionId)
    this.hub.broadcast({ type: 'prototypes', projectId })
  }
}
