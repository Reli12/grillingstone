// Every backend URL the frontend calls, built in one place. Ids are URL-encoded here so callers
// can pass them raw.

const projectPath = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`
const draftPath = (projectId: string, draftId: string) =>
  `${projectPath(projectId)}/drafts/${encodeURIComponent(draftId)}`

export const endpoints = {
  settings: '/api/settings',
  projects: '/api/projects',
  project: projectPath,
  glossary: (projectId: string) => `${projectPath(projectId)}/glossary`,
  drafts: (projectId: string) => `${projectPath(projectId)}/drafts`,
  draft: draftPath,
  draftOps: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/ops`,
  draftReferences: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/references`,
  decide: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/proposal/decide`,
  acceptClean: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/proposal/accept-clean`,
  render: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/render`,
  draftSessions: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/sessions`,
  continueSession: (projectId: string, draftId: string, sessionId: string) =>
    `${draftPath(projectId, draftId)}/sessions/${encodeURIComponent(sessionId)}/continue`,
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
