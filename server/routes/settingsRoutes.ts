// Settings routes: read and save the human's Settings.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { settingsBody } from '../http/schemas.ts'
import { getSettings, saveSettings } from '../storage/settings.ts'

export function settingsRoutes(router: Router) {
  router.get('/api/settings', () => getSettings())
  router.put('/api/settings', ({ body }) => saveSettings(parse(settingsBody, body)))
}
