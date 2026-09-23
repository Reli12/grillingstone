import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { Hub } from './hub.ts'

let server: http.Server
afterEach(() => new Promise((resolve) => server.close(resolve)))

async function listen(hub: Hub) {
  server = http.createServer()
  hub.attach(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `ws://127.0.0.1:${(server.address() as { port: number }).port}`
}

describe('Hub', () => {
  it('sends every event to every open tab', async () => {
    const hub = new Hub()
    const url = await listen(hub)
    const ws = new WebSocket(`${url}/api/ws`)
    await new Promise((resolve) => ws.on('open', resolve))
    const received = new Promise((resolve) => ws.on('message', (data) => resolve(JSON.parse(String(data)))))
    hub.broadcast({ type: 'templates' })
    expect(await received).toEqual({ type: 'templates' })
    ws.close()
  })

  it('refuses other paths and other origins', async () => {
    const url = await listen(new Hub())
    const refused = (ws: WebSocket) => new Promise((resolve) => ws.on('error', () => resolve(true)))
    expect(await refused(new WebSocket(`${url}/elsewhere`))).toBe(true)
    expect(await refused(new WebSocket(`${url}/api/ws`, { origin: 'https://evil.example' }))).toBe(true)
  })
})
