// The local backend (ADR-0009): HTTP + websocket on 127.0.0.1, supervising Grilling and Template Sessions.
import http from 'node:http'

import { createApp } from './app.ts'
import { SERVER_PORT } from './config.ts'
import { Hub } from './hub.ts'
import { createServices } from './services/createServices.ts'

/** Upper bound on waiting for sessions to save at shutdown: just past the Supervisor's 3 s SIGTERM→SIGKILL grace. */
const SHUTDOWN_GRACE_MS = 4000

const hub = new Hub()
const deps = createServices(hub)
await deps.supervisor.markInterrupted()

const server = http.createServer(createApp(deps))
hub.attach(server)
server.listen(SERVER_PORT, '127.0.0.1', () => console.log(`[whetstone] backend on http://127.0.0.1:${SERVER_PORT}`))

const shutdown = () => {
  server.close()
  // Exit as soon as every session has saved its Transcript, or at the grace limit if one hangs.
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref()
  void deps.supervisor.stopAll().finally(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
