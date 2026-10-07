// The websocket to the backend that carries server events. It reconnects on its own, so a backend
// restart during development heals without a page reload.
import type { ServerEvent } from '#core/session/sessionTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'

/** Each failed attempt waits this much longer before the next one... */
const RECONNECT_STEP_MS = 400
/** ...up to this ceiling, so a long backend outage still retries every few seconds. */
const MAX_RECONNECT_DELAY_MS = 5000

interface ServerSocketHandlers {
  /** `reconnected` is true when this open follows a dropped connection. */
  onOpen: (reconnected: boolean) => void
  onEvent: (event: ServerEvent) => void
  onClose: () => void
}

/** The socket URL on the page's own host, secure when the page is. */
function socketUrl() {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}${endpoints.socket}`
}

/** Keeps one websocket to the backend open, reconnecting with backoff. Returns a function that closes it for good. */
export function connectServerSocket({ onOpen, onEvent, onClose }: ServerSocketHandlers) {
  let ws: WebSocket | null = null
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const connect = () => {
    ws = new WebSocket(socketUrl())
    ws.onopen = () => {
      onOpen(retry > 0)
      retry = 0
    }
    ws.onmessage = (message) => {
      try {
        onEvent(JSON.parse(String(message.data)) as ServerEvent)
      } catch {
        // A malformed event cannot be applied. Dropping it keeps the socket alive; the data it
        // touched is refetched the next time it is invalidated (at the latest, on reconnect).
      }
    }
    ws.onclose = () => {
      if (disposed) return
      onClose()
      retry++
      timer = setTimeout(connect, Math.min(MAX_RECONNECT_DELAY_MS, RECONNECT_STEP_MS * retry))
    }
  }
  connect()

  return () => {
    disposed = true
    clearTimeout(timer)
    ws?.close()
  }
}
