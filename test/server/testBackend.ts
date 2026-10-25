// Boots the real backend for server tests: HTTP API + Supervisor on GRILLINGSTONE_SERVER_PORT, data in data-test/,
// `claude` replaced by test/server/fakeClaude.mjs. Server events are recorded instead of sent over a socket.
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

import { vi } from 'vitest'

import type { ServerEvent } from '#core/session/sessionTypes.ts'

import { createApp } from '../../server/app.ts'
import { DATA_DIR, SERVER_PORT, SERVER_URL } from '../../server/config.ts'
import { Hub } from '../../server/hub.ts'
import { createServices } from '../../server/services/createServices.ts'

export interface Reply<T = any> {
  status: number
  body: T
}

/** Empties data-test/ — and refuses to touch any other folder. */
export async function resetTestData() {
  if (path.basename(DATA_DIR) !== 'data-test')
    throw new Error(`Server tests must run with GRILLINGSTONE_DATA_DIR=data-test, not ${DATA_DIR}`)
  await fs.rm(DATA_DIR, { recursive: true, force: true })
}

export async function startBackend() {
  await resetTestData()
  const hub = new Hub()
  const events: ServerEvent[] = []
  vi.spyOn(hub, 'broadcast').mockImplementation((e) => void events.push(e))
  const deps = createServices(hub)
  const { supervisor } = deps
  const server = http.createServer(createApp(deps))
  await new Promise<void>((resolve) => server.listen(SERVER_PORT, '127.0.0.1', resolve))

  const call = async <T = any>(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply<T>> => {
    const res = await fetch(`${SERVER_URL}${url}`, {
      method,
      headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
    return { status: res.status, body: (await res.json()) as T }
  }

  /** A GET whose answer is not JSON (an Image): the status, content type and bytes. */
  const raw = async (url: string) => {
    const res = await fetch(`${SERVER_URL}${url}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    return { status: res.status, contentType: res.headers.get('content-type'), bytes }
  }

  const close = async () => {
    // Wait for every session to save, so the next test's reset cannot delete data-test/ under a late write.
    await supervisor.stopAll()
    await new Promise((resolve) => server.close(resolve))
  }
  return { call, raw, events, supervisor, close }
}
