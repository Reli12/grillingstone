// Browser smoke tests (`npm run test:e2e`): the real backend with the fake Assistants and the Vite dev server, on
// their own ports and data folder, so they run beside `npm run dev` (5310/5311) and `npm test` (5397, data-test/).
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

import type { AssistantOptions } from './e2e/fixtures.ts'

const SERVER_PORT = '5398'
const WEB_PORT = '5399'
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`
const FAKE_CLAUDE = fileURLToPath(new URL('./test/server/fakeClaude.mjs', import.meta.url))
const FAKE_CODEX = fileURLToPath(new URL('./test/server/fakeCodex.mjs', import.meta.url))
/** The journeys run again on Codex: the main one and the Template Session (ADR-0020). */
const CODEX_SPECS = ['draftGoldenPath.spec.ts', 'templateSession.spec.ts']
// Test evidence stays in a git-ignored data* folder inside the project, apart from data-e2e/, which the
// backend wipes at start.
const RESULTS_DIR = 'data-e2e-results'

const ports = { GRILLINGSTONE_SERVER_PORT: SERVER_PORT, GRILLINGSTONE_WEB_PORT: WEB_PORT }

export default defineConfig<AssistantOptions>({
  testDir: 'e2e',
  // One backend and one data folder: specs run one after another.
  fullyParallel: false,
  workers: 1,
  outputDir: `${RESULTS_DIR}/artifacts`,
  reporter: [['list'], ['html', { outputFolder: `${RESULTS_DIR}/report`, open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-codex', testMatch: CODEX_SPECS, use: { ...devices['Desktop Chrome'], assistant: 'codex' } },
  ],
  // Never reuse a running server: a taken port should fail loudly, not test whatever answers there.
  webServer: [
    {
      command: 'node e2e/startBackend.mjs',
      // The backend allows browser calls only from GRILLINGSTONE_WEB_PORT, so it needs both ports.
      env: {
        ...ports,
        GRILLINGSTONE_DATA_DIR: 'data-e2e',
        GRILLINGSTONE_CLAUDE_BIN: FAKE_CLAUDE,
        GRILLINGSTONE_CODEX_BIN: FAKE_CODEX,
      },
      port: Number(SERVER_PORT),
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/vite/bin/vite.js',
      env: ports,
      url: WEB_URL,
      reuseExistingServer: false,
    },
  ],
})
