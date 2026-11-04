// Project API: Projects, their Draft lists and Glossary, and the app-wide Settings.
import type { DraftSummary, GlossaryDoc, ProjectSummary, Settings } from '#core/contract/apiTypes.ts'
import type { Project } from '#core/contract/apiTypes.ts'
import type { Tracker } from '#core/shared/tracker.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export const projectsApi = {
  getProjects: () => api.get<ProjectSummary[]>(endpoints.projects),
  getProject: (projectId: string) => api.get<Project>(endpoints.project(projectId)),
  createProject: ({ name, tracker, glossary }: { name: string; tracker: Tracker; glossary?: string }) =>
    api.post<Project>(endpoints.projects, glossary ? { name, tracker, glossary } : { name, tracker }),
  renameProject: (projectId: string, name: string) => api.patch<Project>(endpoints.project(projectId), { name }),
  /** Refused once the Project has a Draft. */
  changeTracker: (projectId: string, tracker: Tracker) => api.patch<Project>(endpoints.project(projectId), { tracker }),
  deleteProject: (projectId: string) => api.delete<{ ok: true }>(endpoints.project(projectId)),
  getDrafts: (projectId: string) => api.get<DraftSummary[]>(endpoints.drafts(projectId)),
  getGlossary: (projectId: string) => api.get<GlossaryDoc>(endpoints.glossary(projectId)),
  saveGlossary: (projectId: string, markdown: string, baseVersion: string) =>
    api.put<GlossaryDoc>(endpoints.glossary(projectId), { markdown, baseVersion }),
  getSettings: () => api.get<Settings>(endpoints.settings),
  saveSettings: (settings: Settings) => api.put<Settings>(endpoints.settings, settings),
}
