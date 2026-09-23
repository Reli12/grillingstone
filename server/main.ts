// The local backend (ADR-0009): HTTP + websocket on 127.0.0.1, supervising Grilling and Template Sessions.
import http from 'node:http'
import { createApp } from './app.ts'
import { SERVER_PORT } from './config.ts'
import { Hub } from './hub.ts'
import { createServices } from './services/createServices.ts'

const hub = new Hub()
const deps = createServices(hub)
await deps.supervisor.markInterrupted()

const server = http.createServer(createApp(deps))
hub.attach(server)
server.listen(SERVER_PORT, '127.0.0.1', () => console.log(`[whetstone] backend on http://127.0.0.1:${SERVER_PORT}`))

const shutdown = () => {
  deps.supervisor.stopAll()
  server.close()
  setTimeout(() => process.exit(0), 500).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
