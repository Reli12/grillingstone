import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { exportBody, importBody, importPreviewBody, templateBody } from '../http/schemas.ts'
import { now } from '../services/clock.ts'
import { exportTemplates, getTemplate, listTemplates, previewTemplateImport } from '../storage/templates.ts'
import type { AppDeps } from './deps.ts'

export function templateRoutes(r: Router, { templates }: AppDeps) {
  r.get('/api/templates', () => listTemplates())
  r.get('/api/templates/:templateId', ({ params }) => getTemplate(params.templateId))
  r.post('/api/templates', ({ body }) => templates.create(parse(templateBody, body)))
  r.put('/api/templates/:templateId', ({ params, body }) =>
    templates.update(params.templateId, parse(templateBody, body)),
  )
  r.delete('/api/templates/:templateId', async ({ params }) => {
    await templates.delete(params.templateId)
    return { ok: true }
  })
  r.post('/api/templates/export', ({ body }) => exportTemplates(parse(exportBody, body).ids, now()))
  r.post('/api/templates/import/preview', ({ body }) => previewTemplateImport(parse(importPreviewBody, body).bundle))
  r.post('/api/templates/import', ({ body }) => {
    const { bundle, selected } = parse(importBody, body)
    return templates.import(bundle, selected)
  })
}
