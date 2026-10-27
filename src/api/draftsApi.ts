// Draft API: reading and changing a Draft, its Proposal and references, and driving its Grilling
// Sessions (start, continue, answer, write now, stop).
import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import type { CopyPayload } from '#core/publish/copyFields.ts'
import type { ImageUpload } from '#core/session/images.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export interface DraftWithSession {
  draft: Draft
  liveSession: SessionSummary | null
}

export interface NewDraftRequest {
  workItemType: WorkItemType
  templateId: string
  requirement: string
  references: string[]
  /** Shown with the requirement to the first session; left out of the body when empty. */
  images?: ImageUpload[]
  /** Prototypes of the Project the first session may read; left out of the body when empty. */
  prototypeIds?: string[]
  /** Create Draft…: the Prototype the Draft is created from, which its first session is given. */
  createdFromPrototypeId?: string
}

export interface StartSessionRequest {
  kind: SessionKind
  focus?: { sectionId: string; entryId?: string }
  humanNote?: string
  /** Prototypes of the Project Claude may read as context; left out of the body when empty. */
  prototypeIds?: string[]
  /** Sent with the first message; left out of the body when empty. */
  images?: ImageUpload[]
}

export interface SayRequest {
  text: string
  kind: 'answer' | 'message'
  images?: ImageUpload[]
}

export const draftsApi = {
  getDraft: (projectId: string, draftId: string) => api.get<DraftWithSession>(endpoints.draft(projectId, draftId)),
  createDraft: (projectId: string, { images = [], createdFromPrototypeId, ...body }: NewDraftRequest) =>
    api.post<{ draft: Draft; session: SessionSummary }>(
      createdFromPrototypeId
        ? endpoints.draftFromPrototype(projectId, createdFromPrototypeId)
        : endpoints.drafts(projectId),
      { ...body, ...(images.length ? { images } : {}) },
    ),
  deleteDraft: (projectId: string, draftId: string) => api.delete<{ ok: true }>(endpoints.draft(projectId, draftId)),
  applyOp: (projectId: string, draftId: string, op: HumanOp) =>
    api.post<Draft>(endpoints.draftOps(projectId, draftId), op),
  setReferences: (projectId: string, draftId: string, references: string[]) =>
    api.patch<Draft>(endpoints.draftReferences(projectId, draftId), { references }),
  decide: (projectId: string, draftId: string, changeId: string, accept: boolean) =>
    api.post<Draft>(endpoints.decide(projectId, draftId), { changeId, accept }),
  acceptAllClean: (projectId: string, draftId: string) => api.post<Draft>(endpoints.acceptClean(projectId, draftId)),
  copyFields: (projectId: string, draftId: string) => api.get<CopyPayload>(endpoints.copyFields(projectId, draftId)),
  getTranscripts: (projectId: string, draftId: string) =>
    api.get<Transcript[]>(endpoints.draftSessions(projectId, draftId)),
  startSession: (projectId: string, draftId: string, body: StartSessionRequest) =>
    api.post<SessionSummary>(endpoints.draftSessions(projectId, draftId), body),
  continueSession: (projectId: string, draftId: string, sessionId: string, humanNote: string) =>
    api.post<SessionSummary>(endpoints.continueSession(projectId, draftId, sessionId), { humanNote }),
  say: (sessionId: string, { text, kind, images = [] }: SayRequest) =>
    // The images key is left out when there are none, so a text-only message is the body it always was.
    api.post<{ ok: true }>(endpoints.sessionMessages(sessionId), { text, kind, ...(images.length ? { images } : {}) }),
  writeNow: (sessionId: string) => api.post<{ ok: true }>(endpoints.sessionWrite(sessionId)),
  stop: (sessionId: string) => api.post<{ ok: true }>(endpoints.sessionStop(sessionId)),
}
