// Template routes: list, read, create, edit, delete, and export or import Template bundles.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { exportBody, importBody, importPreviewBody, templateBody } from '../http/schemas.ts'
import { now } from '../services/clock.ts'
import { exportTemplates, getTemplate, listTemplates, previewTemplateImport } from '../storage/templates.ts'
import type { AppDeps } from './deps.ts'

export function templateRoutes(router: Router, { templates }: AppDeps) {
  router.get('/api/templates', () => listTemplates())
  router.get('/api/templates/:templateId', ({ params }) => getTemplate(params.templateId))
  router.post('/api/templates', ({ body }) => templates.create(parse(templateBody, body)))
  router.put('/api/templates/:templateId', ({ params, body }) =>
    templates.update(params.templateId, parse(templateBody, body)),
  )
  router.delete('/api/templates/:templateId', async ({ params }) => {
    await templates.delete(params.templateId)
    return { ok: true }
  })
  router.post('/api/templates/export', ({ body }) => exportTemplates(parse(exportBody, body).ids, now()))
  router.post('/api/templates/import/preview', ({ body }) =>
    previewTemplateImport(parse(importPreviewBody, body).bundle),
  )
  router.post('/api/templates/import', ({ body }) => {
    const { bundle, selected } = parse(importBody, body)
    return templates.import(bundle, selected)
  })
}
