import type { ServerEvent } from '#core/session/sessionTypes.ts'
import { endpoints } from '@/api/endpoints/endpoints'

interface ServerSocketHandlers {
  /** `reconnected` is true when this open follows a dropped connection. */
  onOpen: (reconnected: boolean) => void
  onEvent: (event: ServerEvent) => void
  onClose: () => void
}

/** Keeps one websocket to the backend open, reconnecting with backoff. Returns a function that closes it for good. */
export function connectServerSocket({ onOpen, onEvent, onClose }: ServerSocketHandlers) {
  let ws: WebSocket | null = null
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const connect = () => {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${endpoints.socket}`
    ws = new WebSocket(url)
    ws.onopen = () => {
      onOpen(retry > 0)
      retry = 0
    }
    ws.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(msg.data) as ServerEvent)
      } catch {
        /* ignore malformed events */
      }
    }
    ws.onclose = () => {
      if (disposed) return
      onClose()
      retry++
      timer = setTimeout(connect, Math.min(5000, 400 * retry))
    }
  }
  connect()

  return () => {
    disposed = true
    clearTimeout(timer)
    ws?.close()
  }
}
