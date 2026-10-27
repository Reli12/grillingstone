// Every backend URL the frontend calls, built in one place. Ids are URL-encoded here so callers
// can pass them raw.

const projectPath = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`
const draftPath = (projectId: string, draftId: string) =>
  `${projectPath(projectId)}/drafts/${encodeURIComponent(draftId)}`
const grillingPath = (projectId: string, sessionId: string) =>
  `${projectPath(projectId)}/prototype-grilling-sessions/${encodeURIComponent(sessionId)}`

export const endpoints = {
  settings: '/api/settings',
  projects: '/api/projects',
  project: projectPath,
  glossary: (projectId: string) => `${projectPath(projectId)}/glossary`,
  drafts: (projectId: string) => `${projectPath(projectId)}/drafts`,
  draft: draftPath,
  /** POST creates a Draft from a Prototype and starts its first session. */
  draftFromPrototype: (projectId: string, prototypeId: string) =>
    `${projectPath(projectId)}/prototypes/${encodeURIComponent(prototypeId)}/drafts`,
  draftOps: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/ops`,
  draftReferences: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/references`,
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
  draftPrototypes: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/prototypes`,
  draftPrototypeImages: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/prototype-images`,
  startPrototype: (projectId: string, draftId: string) => `${draftPath(projectId, draftId)}/prototype-sessions`,
  /** Every row of every Draft in the Project. */
  projectPrototypes: (projectId: string) => `${projectPath(projectId)}/prototypes`,
  stopPrototype: (projectId: string, sessionId: string) =>
    `${projectPath(projectId)}/prototype-sessions/${encodeURIComponent(sessionId)}/stop`,
  /** DELETE dismisses a Failed or Stopped session. */
  prototypeSession: (projectId: string, sessionId: string) =>
    `${projectPath(projectId)}/prototype-sessions/${encodeURIComponent(sessionId)}`,
  /** What a session was started with, for Try again. */
  prototypeSessionInputs: (projectId: string, sessionId: string) =>
    `${projectPath(projectId)}/prototype-sessions/${encodeURIComponent(sessionId)}/inputs`,
  /** POST starts a Prototype Grilling Session. */
  startPrototypeGrilling: (projectId: string) => `${projectPath(projectId)}/prototype-grilling-sessions`,
  /** GET reads the session with its conversation. */
  prototypeGrillingSession: grillingPath,
  prototypeGrillingMessages: (projectId: string, sessionId: string) => `${grillingPath(projectId, sessionId)}/messages`,
  prototypeGrillingStop: (projectId: string, sessionId: string) => `${grillingPath(projectId, sessionId)}/stop`,
  prototypeGrillingContinue: (projectId: string, sessionId: string) => `${grillingPath(projectId, sessionId)}/continue`,
  prototypeGrillingEnd: (projectId: string, sessionId: string) => `${grillingPath(projectId, sessionId)}/end`,
  /** An Image of the session's own folder, by its number in the session. */
  prototypeGrillingImage: (projectId: string, sessionId: string, number: number) =>
    `${grillingPath(projectId, sessionId)}/images/${number}`,
  prototype: (projectId: string, prototypeId: string) =>
    `${projectPath(projectId)}/prototypes/${encodeURIComponent(prototypeId)}`,
  /** The sandboxed page itself, for the viewer's iframe. */
  prototypeView: (projectId: string, prototypeId: string) =>
    `${projectPath(projectId)}/prototypes/${encodeURIComponent(prototypeId)}/view`,
  /** The same page as a file the browser saves. */
  prototypeDownload: (projectId: string, prototypeId: string) =>
    `${projectPath(projectId)}/prototypes/${encodeURIComponent(prototypeId)}/view?download=1`,
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
