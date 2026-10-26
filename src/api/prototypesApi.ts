// Prototype API: a Draft's and a Project's Prototype rows, the Images the start form offers, starting and stopping a
// Prototype Session, Delete and Dismiss, what a session was started with, and one Prototype's record for the viewer.
import type { DraftImage, Prototype, PrototypeRow, TickedImage } from '#core/prototype/prototypeRecords.ts'
import type { ImageUpload } from '#core/session/images.ts'
import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export interface StartPrototypeRequest {
  /** Images of the Draft's Grilling Sessions that stay ticked. */
  tickedImages: TickedImage[]
  extraImages: ImageUpload[]
  startingPrototypeId?: string
}

/** What a session was started with, with the extra Images' bytes: 'Try again' refills the start form from it. */
export type PrototypeSessionInputs = StartPrototypeRequest

/** A Prototype with the title of its Draft, which the viewer's bar shows. */
export interface PrototypeRecord {
  prototype: Prototype
  draftTitle: string
}

export const prototypesApi = {
  getDraftRows: (projectId: string, draftId: string) =>
    api.get<PrototypeRow[]>(endpoints.draftPrototypes(projectId, draftId)),
  getDraftImages: (projectId: string, draftId: string) =>
    api.get<DraftImage[]>(endpoints.draftPrototypeImages(projectId, draftId)),
  start: (projectId: string, draftId: string, { extraImages, ...rest }: StartPrototypeRequest) =>
    // The extra Images key is left out when there are none, as for a message.
    api.post<PrototypeSessionSummary>(endpoints.startPrototype(projectId, draftId), {
      ...rest,
      ...(extraImages.length ? { extraImages } : {}),
    }),
  stop: (projectId: string, sessionId: string) => api.post<{ ok: true }>(endpoints.stopPrototype(projectId, sessionId)),
  getProjectRows: (projectId: string) => api.get<PrototypeRow[]>(endpoints.projectPrototypes(projectId)),
  getSessionInputs: (projectId: string, sessionId: string) =>
    api.get<PrototypeSessionInputs>(endpoints.prototypeSessionInputs(projectId, sessionId)),
  getPrototype: (projectId: string, prototypeId: string) =>
    api.get<PrototypeRecord>(endpoints.prototype(projectId, prototypeId)),
  remove: (projectId: string, prototypeId: string) =>
    api.delete<{ ok: true }>(endpoints.prototype(projectId, prototypeId)),
  dismiss: (projectId: string, sessionId: string) =>
    api.delete<{ ok: true }>(endpoints.prototypeSession(projectId, sessionId)),
}
