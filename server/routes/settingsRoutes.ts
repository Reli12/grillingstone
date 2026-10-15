// Settings routes: read and save the human's Settings, answered with whether each Assistant can run now.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { settingsBody } from '../http/schemas.ts'
import { settingsView } from '../sessions/assistants.ts'
import { saveSettings } from '../storage/settings.ts'

export function settingsRoutes(router: Router) {
  router.get('/api/settings', () => settingsView())
  router.put('/api/settings', async ({ body }) => {
    await saveSettings(parse(settingsBody, body))
    return settingsView()
  })
}
