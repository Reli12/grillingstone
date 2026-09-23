import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { settingsBody } from '../http/schemas.ts'
import { getSettings, saveSettings } from '../storage/settings.ts'

export function settingsRoutes(r: Router) {
  r.get('/api/settings', () => getSettings())
  r.put('/api/settings', ({ body }) => saveSettings(parse(settingsBody, body)))
}
