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
  draftBacklogReferences: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/backlog-references`,
  draftLane: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/lane`,
  draftArchived: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/archived`,
  backlogCopies: (projectId: string) => `${projectPath(projectId)}/backlog-copies`,
  backlogCopy: (projectId: string, copyId: string) =>
    `${projectPath(projectId)}/backlog-copies/${encodeURIComponent(copyId)}`,
  codeFolders: (projectId: string) => `${projectPath(projectId)}/code-folders`,
  codeFolder: (projectId: string, folderId: string) =>
    `${projectPath(projectId)}/code-folders/${encodeURIComponent(folderId)}`,
  codeFolderCheck: (projectId: string) => `${projectPath(projectId)}/code-folders/check`,
  codeFolderState: (projectId: string) => `${projectPath(projectId)}/code-folders/state`,
  codeFolderExclusions: (projectId: string, folderId: string) =>
    `${projectPath(projectId)}/code-folders/${encodeURIComponent(folderId)}/exclusions`,
  decide: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/proposal/decide`,
  acceptClean: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/proposal/accept-clean`,
  copyFields: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/copy`,
  draftSessions: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/sessions`,
  continueSession: (projectId: string, draftId: string, sessionId: string) =>
    `${draftPath(projectId, draftId)}/sessions/${encodeURIComponent(sessionId)}/continue`,
  sessionMessages: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
  sessionImage: (projectId: string, sessionId: string, number: number) =>
    `${projectPath(projectId)}/sessions/${encodeURIComponent(sessionId)}/images/${number}`,
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
  connection: '/api/connection',
  projectBacklog: (projectId: string) => `${projectPath(projectId)}/backlog`,
  projectDefaultTags: (projectId: string) => `${projectPath(projectId)}/default-tags`,
  projectRevisions: (projectId: string) => `${projectPath(projectId)}/revisions`,
  workItemLookup: (projectId: string) => `${projectPath(projectId)}/work-items/lookup`,
  importDraft: (projectId: string) => `${projectPath(projectId)}/drafts/import`,
  publishPlan: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/publish/plan`,
  publish: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/publish`,
  draftLink: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/link`,
  driftCheck: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/drift-check`,
  draftParent: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/parent`,
  refreshCopy: (projectId: string, copyId: string) =>
    `${projectPath(projectId)}/backlog-copies/${encodeURIComponent(copyId)}/refresh`,
  refreshAllCopies: (projectId: string) => `${projectPath(projectId)}/backlog-copies/refresh-all`,
  fetchCopy: (projectId: string) => `${projectPath(projectId)}/backlog-copies/fetch`,
  importCopy: (projectId: string, copyId: string) =>
    `${projectPath(projectId)}/backlog-copies/${encodeURIComponent(copyId)}/import`,
}
