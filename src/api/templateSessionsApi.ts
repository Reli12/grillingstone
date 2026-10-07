import type { TemplateRequest, TemplateSessionSummary, TemplateTranscript } from '#core/session/sessionTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export type NewTemplateSessionRequest = Omit<TemplateRequest, 'baseTemplateName'>

export const templateSessionsApi = {
  getLive: () => api.get<{ session: TemplateSessionSummary | null }>(endpoints.liveTemplateSession),
  getTranscript: (sessionId: string) => api.get<TemplateTranscript>(endpoints.templateSession(sessionId)),
  start: (body: NewTemplateSessionRequest) => api.post<TemplateSessionSummary>(endpoints.templateSessions, body),
}
