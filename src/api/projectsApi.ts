// Project API: Projects, their Draft lists and Glossary, and the app-wide Settings.
import type { DraftSummary, GlossaryDoc, ProjectSummary, Settings, SettingsView } from '#core/contract/apiTypes.ts'
import type { Project } from '#core/contract/apiTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export const projectsApi = {
  getProjects: () => api.get<ProjectSummary[]>(endpoints.projects),
  getProject: (projectId: string) => api.get<Project>(endpoints.project(projectId)),
  createProject: ({ name, glossary }: { name: string; glossary?: string }) =>
    api.post<Project>(endpoints.projects, glossary ? { name, glossary } : { name }),
  renameProject: (projectId: string, name: string) => api.patch<Project>(endpoints.project(projectId), { name }),
  getDrafts: (projectId: string) => api.get<DraftSummary[]>(endpoints.drafts(projectId)),
  getGlossary: (projectId: string) => api.get<GlossaryDoc>(endpoints.glossary(projectId)),
  saveGlossary: (projectId: string, markdown: string, baseVersion: string) =>
    api.put<GlossaryDoc>(endpoints.glossary(projectId), { markdown, baseVersion }),
  getSettings: () => api.get<SettingsView>(endpoints.settings),
  // Only the Settings themselves: a SettingsView passed in also carries availability, which is not saved.
  saveSettings: ({ author, assistant, models, theme }: Settings) =>
    api.put<SettingsView>(endpoints.settings, { author, assistant, models, theme }),
}
