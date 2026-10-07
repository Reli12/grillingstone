// Pushes ServerEvents to every open browser tab. Single-user and local: every tab gets every event
// and filters by Project / Draft itself.
import type { IncomingMessage, Server } from 'node:http'

import { type WebSocket, WebSocketServer } from 'ws'

import type { ServerEvent } from '#core/session/sessionTypes.ts'

import { ALLOWED_ORIGINS } from './config.ts'

export class Hub {
  private wss = new WebSocketServer({ noServer: true })
  private clients = new Set<WebSocket>()

  attach(server: Server) {
    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const origin = req.headers.origin
      if (!req.url?.startsWith('/api/ws') || (origin && !ALLOWED_ORIGINS.has(origin))) {
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.clients.add(ws)
        ws.on('close', () => this.clients.delete(ws))
        // A socket that errored can no longer receive events, so it is dropped like a closed one.
        ws.on('error', () => this.clients.delete(ws))
      })
    })
  }

  broadcast(event: ServerEvent) {
    const data = JSON.stringify(event)
    for (const ws of this.clients) if (ws.readyState === ws.OPEN) ws.send(data)
  }
}
