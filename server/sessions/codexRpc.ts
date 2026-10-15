// The JSON-RPC connection to one `codex app-server`: requests the backend sends and the answers it waits for,
// and, coming the other way, notifications and the requests app-server sends the backend to answer.
import type { ChildProcess } from 'node:child_process'

import { jsonLines } from './jsonLines.ts'

type Params = Record<string, unknown>

/** JSON-RPC's error code for a request the server could not carry out. */
const REQUEST_FAILED = -32000

export interface IncomingRequest {
  id: unknown
  method: string
  params: Params
}

export interface RpcHandlers {
  onNotification: (method: string, params: Params) => void
  onRequest: (request: IncomingRequest) => void
}

export interface CodexRpc {
  /** Sends a request; resolves with its result, rejects with its error. */
  request: (method: string, params: Params) => Promise<Params>
  notify: (method: string, params?: Params) => void
  respond: (id: unknown, result: Params) => void
  refuse: (id: unknown, message: string) => void
}

const errorText = (error: unknown) => (error as { message?: string } | undefined)?.message ?? JSON.stringify(error)

export function codexRpc(child: ChildProcess, handlers: RpcHandlers): CodexRpc {
  let nextId = 1
  /** Request id → what to do with its answer. */
  const pending = new Map<number, (message: Params) => void>()
  const write = (message: Params) => void child.stdin?.write(`${JSON.stringify(message)}\n`)

  // A write after Codex has exited fails with EPIPE; the exit itself is reported, so the failed write is not.
  child.stdin?.on('error', () => {})
  // No answer comes once Codex has exited: fail what is still waiting, so nothing hangs on it.
  child.on('close', () => {
    for (const answer of pending.values()) answer({ error: { message: 'Codex exited' } })
    pending.clear()
  })
  child.stdout!.setEncoding('utf8')
  child.stdout!.on(
    'data',
    jsonLines((message) => {
      const method = typeof message.method === 'string' ? message.method : undefined
      const params = (message.params ?? {}) as Params
      if (method && message.id !== undefined) handlers.onRequest({ id: message.id, method, params })
      else if (method) handlers.onNotification(method, params)
      else {
        pending.get(message.id as number)?.(message)
        pending.delete(message.id as number)
      }
    }),
  )

  return {
    request: (method, params) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, (message) => {
          if (message.error) reject(new Error(`${method} failed: ${errorText(message.error)}`))
          else resolve((message.result ?? {}) as Params)
        })
        write({ id, method, params })
      }),
    // JSON leaves out undefined params, which is how a notification without any is sent.
    notify: (method, params) => write({ method, params }),
    respond: (id, result) => write({ id, result }),
    refuse: (id, message) => write({ id, error: { code: REQUEST_FAILED, message } }),
  }
}
