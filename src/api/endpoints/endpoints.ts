const p = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`
const d = (projectId: string, draftId: string) => `${p(projectId)}/drafts/${encodeURIComponent(draftId)}`

export const endpoints = {
  settings: '/api/settings',
  projects: '/api/projects',
  project: p,
  glossary: (projectId: string) => `${p(projectId)}/glossary`,
  drafts: (projectId: string) => `${p(projectId)}/drafts`,
  draft: d,
  draftOps: (projectId: string, draftId: string) => `${d(projectId, draftId)}/ops`,
  draftReferences: (projectId: string, draftId: string) => `${d(projectId, draftId)}/references`,
  decide: (projectId: string, draftId: string) => `${d(projectId, draftId)}/proposal/decide`,
  acceptClean: (projectId: string, draftId: string) => `${d(projectId, draftId)}/proposal/accept-clean`,
  render: (projectId: string, draftId: string) => `${d(projectId, draftId)}/render`,
  draftSessions: (projectId: string, draftId: string) => `${d(projectId, draftId)}/sessions`,
  continueSession: (projectId: string, draftId: string, sessionId: string) =>
    `${d(projectId, draftId)}/sessions/${encodeURIComponent(sessionId)}/continue`,
  sessionMessages: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
  sessionWrite: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}/write`,
  sessionStop: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}/stop`,
  templates: '/api/templates',
  template: (id: string) => `/api/templates/${encodeURIComponent(id)}`,
  templatesExport: '/api/templates/export',
  templatesImportPreview: '/api/templates/import/preview',
  templatesImport: '/api/templates/import',
  templateSessions: '/api/template-sessions',
  liveTemplateSession: '/api/template-sessions/live',
  templateSession: (sessionId: string) => `/api/template-sessions/${encodeURIComponent(sessionId)}`,
  socket: '/api/ws',
}
