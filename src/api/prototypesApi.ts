// Prototype API: a Draft's and a Project's Prototype rows, the Images the start form offers, starting and stopping a
// Prototype Session, a Prototype Grilling Session (start, read, say, stop, end), Delete and Dismiss, what a session was
// started with, and one Prototype's record for the viewer.
import type {
  DraftImage,
  Prototype,
  PrototypeGrillingSession,
  PrototypeRow,
  TickedImage,
} from '#core/prototype/prototypeRecords.ts'
import type { ImageUpload } from '#core/session/images.ts'
import type {
  PrototypeGrillingSessionSummary,
  PrototypeSessionSummary,
  PrototypeStep,
} from '#core/session/sessionTypes.ts'

import { api } from '@/api/apiMethods'
import type { SayRequest } from '@/api/draftsApi'
import { endpoints } from '@/api/endpoints/endpoints'

export interface StartPrototypeRequest {
  /** Images of the Draft's Grilling Sessions that stay ticked. */
  tickedImages: TickedImage[]
  extraImages: ImageUpload[]
  startingPrototypeId?: string
}

/** What a session was started with, with the extra Images' bytes: 'Try again' refills the start form from it. */
export type PrototypeSessionInputs = StartPrototypeRequest

/** A Prototype Grilling Session starts from the same inputs, with the Draft optional. */
export interface StartPrototypeGrillingRequest extends StartPrototypeRequest {
  draftId?: string
}

/** A Prototype Grilling Session with its conversation, as the session page reads it; a live one carries Claude's step. */
export type PrototypeGrillingTranscript = PrototypeGrillingSession & { step?: PrototypeStep }

/** The extra Images key is left out when there are none, as for a message. */
const withImages = <T extends { extraImages: ImageUpload[] }>({ extraImages, ...rest }: T) => ({
  ...rest,
  ...(extraImages.length ? { extraImages } : {}),
})

/** A Prototype with the title of its Draft (none for a Prototype of no Draft), which the viewer's bar shows. */
export interface PrototypeRecord {
  prototype: Prototype
  draftTitle?: string
}

export const prototypesApi = {
  getDraftRows: (projectId: string, draftId: string) =>
    api.get<PrototypeRow[]>(endpoints.draftPrototypes(projectId, draftId)),
  getDraftImages: (projectId: string, draftId: string) =>
    api.get<DraftImage[]>(endpoints.draftPrototypeImages(projectId, draftId)),
  start: (projectId: string, draftId: string, body: StartPrototypeRequest) =>
    api.post<PrototypeSessionSummary>(endpoints.startPrototype(projectId, draftId), withImages(body)),
  startGrilling: (projectId: string, body: StartPrototypeGrillingRequest) =>
    api.post<PrototypeGrillingSessionSummary>(endpoints.startPrototypeGrilling(projectId), withImages(body)),
  getGrilling: (projectId: string, sessionId: string) =>
    api.get<PrototypeGrillingTranscript>(endpoints.prototypeGrillingSession(projectId, sessionId)),
  sayInGrilling: (projectId: string, sessionId: string, { text, kind, images = [] }: SayRequest) =>
    api.post<{ ok: true }>(endpoints.prototypeGrillingMessages(projectId, sessionId), {
      text,
      kind,
      ...(images.length ? { images } : {}),
    }),
  stopGrilling: (projectId: string, sessionId: string) =>
    api.post<{ ok: true }>(endpoints.prototypeGrillingStop(projectId, sessionId)),
  continueGrilling: (projectId: string, sessionId: string) =>
    api.post<PrototypeGrillingSessionSummary>(endpoints.prototypeGrillingContinue(projectId, sessionId)),
  endGrilling: (projectId: string, sessionId: string) =>
    api.post<{ ok: true }>(endpoints.prototypeGrillingEnd(projectId, sessionId)),
  removeGrilling: (projectId: string, sessionId: string) =>
    api.delete<{ ok: true }>(endpoints.prototypeGrillingSession(projectId, sessionId)),
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
