// Every React Query key in one place. Keys nest under their Project and Draft, so invalidating a
// parent key also invalidates what hangs below it.
export const queryKeys = {
  settings: ['settings'] as const,
  projects: ['projects'] as const,
  project: (projectId: string) => ['projects', projectId] as const,
  glossary: (projectId: string) => ['projects', projectId, 'glossary'] as const,
  drafts: (projectId: string) => ['projects', projectId, 'drafts'] as const,
  draft: (projectId: string, draftId: string) => ['projects', projectId, 'drafts', draftId] as const,
  transcripts: (projectId: string, draftId: string) => ['projects', projectId, 'drafts', draftId, 'sessions'] as const,
  copyFields: (projectId: string, draftId: string) => ['projects', projectId, 'drafts', draftId, 'copy'] as const,
  // Prototype lists nest under their Project, so one invalidation of `prototypes` refetches a Draft's and the Project's.
  prototypes: (projectId: string) => ['projects', projectId, 'prototypes'] as const,
  projectPrototypes: (projectId: string) => ['projects', projectId, 'prototypes', 'project'] as const,
  draftPrototypes: (projectId: string, draftId: string) =>
    ['projects', projectId, 'prototypes', 'draft', draftId] as const,
  draftImages: (projectId: string, draftId: string) =>
    ['projects', projectId, 'drafts', draftId, 'prototype-images'] as const,
  // Not under `prototypes`: a stored Prototype's record does not change when the lists do.
  prototype: (projectId: string, prototypeId: string) => ['projects', projectId, 'prototype', prototypeId] as const,
  // Not under `prototypes`: the server events fold the session's own status and messages into it.
  prototypeGrillingSession: (projectId: string, sessionId: string) =>
    ['projects', projectId, 'prototype-grilling', sessionId] as const,
  templates: ['templates'] as const,
  // Own root, so invalidating `templates` after an import does not re-run the preview.
  templateImportPreview: (bundle: unknown) => ['templateImportPreview', bundle] as const,
  liveTemplateSession: ['templateSessions', 'live'] as const,
  templateSession: (sessionId: string) => ['templateSessions', sessionId] as const,
}
