import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createLogger } from 'vite'
import { defineConfig } from 'vitest/config'

import packageJson from './package.json' with { type: 'json' }

const serverPort = Number(process.env.GRILLINGSTONE_SERVER_PORT ?? 5311)

// The backend restarts under `node --watch` whenever server/ or core/ changes, cutting every open
// websocket. Vite logs each cut as a "ws proxy error: ECONNRESET" although the browser reconnects
// on its own, so those resets are dropped. Every other proxy error is still logged.
const logger = createLogger()
const logError = logger.error.bind(logger)
logger.error = (msg, options) => {
  const code = (options?.error as NodeJS.ErrnoException | null | undefined)?.code
  if (code === 'ECONNRESET' && msg.includes('ws proxy')) return
  logError(msg, options)
}

export default defineConfig({
  customLogger: logger,
  plugins: [react(), tailwindcss()],
  // The running version, shown in the footer; release-please bumps it in package.json.
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.GRILLINGSTONE_WEB_PORT ?? 5310),
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: `http://127.0.0.1:${serverPort}`, ws: true },
    },
    // Session writes to data/, data-test/ and data-e2e/ must never trigger a reload.
    watch: { ignored: ['**/data*/**'] },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'core', include: ['core/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
          // One backend on one port and one data-test/ folder: run the files one after another.
          fileParallelism: false,
          env: {
            GRILLINGSTONE_DATA_DIR: 'data-test',
            GRILLINGSTONE_SERVER_PORT: '5397',
            GRILLINGSTONE_CLAUDE_BIN: fileURLToPath(new URL('./test/server/fakeClaude.mjs', import.meta.url)),
          },
        },
      },
      {
        extends: true,
        test: { name: 'web', include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['test/setup.ts'] },
      },
    ],
    coverage: {
      provider: 'v8',
      // lcov feeds SonarQube (see sonar-project.properties).
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'core/**/*.ts', 'server/**/*.ts'],
      // Entry points only wire things together; fixtures are test data.
      exclude: ['src/components/ui/**', 'src/main.tsx', 'server/main.ts', 'core/testing/**', '**/*.test.{ts,tsx}'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
