// Template API: the Template library, plus exporting and importing shareable bundles.
import type { Bundle, ImportItem } from '#core/template/templateBundle.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { api } from '@/api/apiMethods'
import { endpoints } from '@/api/endpoints/endpoints'

export type ImportPreview = { ok: true; items: ImportItem[] } | { ok: false; reason: string }

export const templatesApi = {
  getTemplates: () => api.get<Template[]>(endpoints.templates),
  createTemplate: (template: Template) => api.post<Template>(endpoints.templates, { template }),
  updateTemplate: (template: Template) => api.put<Template>(endpoints.template(template.id), { template }),
  deleteTemplate: (id: string) => api.delete<{ ok: true }>(endpoints.template(id)),
  exportBundle: (ids: string[]) => api.post<Bundle>(endpoints.templatesExport, { ids }),
  previewImport: (bundle: unknown) => api.post<ImportPreview>(endpoints.templatesImportPreview, { bundle }),
  importBundle: (bundle: unknown, selected: number[]) =>
    api.post<Template[]>(endpoints.templatesImport, { bundle, selected }),
}
