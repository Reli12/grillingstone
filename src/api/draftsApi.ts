import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import type { Rendered } from '#core/publish/publishRenderer.ts'
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
}

export interface StartSessionRequest {
  kind: SessionKind
  focus?: { sectionId: string; entryId?: string }
  humanNote?: string
}

export const draftsApi = {
  getDraft: (projectId: string, draftId: string) => api.get<DraftWithSession>(endpoints.draft(projectId, draftId)),
  createDraft: (projectId: string, body: NewDraftRequest) => api.post<{ draft: Draft; session: SessionSummary }>(endpoints.drafts(projectId), body),
  deleteDraft: (projectId: string, draftId: string) => api.delete<{ ok: true }>(endpoints.draft(projectId, draftId)),
  applyOp: (projectId: string, draftId: string, op: HumanOp) => api.post<Draft>(endpoints.draftOps(projectId, draftId), op),
  setReferences: (projectId: string, draftId: string, references: string[]) => api.patch<Draft>(endpoints.draftReferences(projectId, draftId), { references }),
  decide: (projectId: string, draftId: string, changeId: string, accept: boolean) => api.post<Draft>(endpoints.decide(projectId, draftId), { changeId, accept }),
  acceptAllClean: (projectId: string, draftId: string) => api.post<Draft>(endpoints.acceptClean(projectId, draftId)),
  render: (projectId: string, draftId: string) => api.get<Rendered>(endpoints.render(projectId, draftId)),
  getTranscripts: (projectId: string, draftId: string) => api.get<Transcript[]>(endpoints.draftSessions(projectId, draftId)),
  startSession: (projectId: string, draftId: string, body: StartSessionRequest) => api.post<SessionSummary>(endpoints.draftSessions(projectId, draftId), body),
  continueSession: (projectId: string, draftId: string, sessionId: string, humanNote: string) =>
    api.post<SessionSummary>(endpoints.continueSession(projectId, draftId, sessionId), { humanNote }),
  say: (sessionId: string, text: string, kind: 'answer' | 'message') => api.post<{ ok: true }>(endpoints.sessionMessages(sessionId), { text, kind }),
  writeNow: (sessionId: string) => api.post<{ ok: true }>(endpoints.sessionWrite(sessionId)),
  stop: (sessionId: string) => api.post<{ ok: true }>(endpoints.sessionStop(sessionId)),
}
