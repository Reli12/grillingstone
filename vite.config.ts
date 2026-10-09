import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const serverPort = Number(process.env.WHETSTONE_SERVER_PORT ?? 5311)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.WHETSTONE_WEB_PORT ?? 5310),
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
            WHETSTONE_DATA_DIR: 'data-test',
            WHETSTONE_SERVER_PORT: '5397',
            WHETSTONE_CLAUDE_BIN: fileURLToPath(new URL('./test/server/fakeClaude.mjs', import.meta.url)),
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
