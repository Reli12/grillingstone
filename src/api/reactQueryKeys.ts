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
  templates: ['templates'] as const,
  // Own root, so invalidating `templates` after an import does not re-run the preview.
  templateImportPreview: (bundle: unknown) => ['templateImportPreview', bundle] as const,
  liveTemplateSession: ['templateSessions', 'live'] as const,
  templateSession: (sessionId: string) => ['templateSessions', sessionId] as const,
}
