// Tests for scripts/codeTools.mjs, the per-session MCP server (ADR-0016): it speaks MCP over stdio, lists the
// three code tools, and forwards each call to the backend with the session's token — against a stub backend.
import { type ChildProcess, spawn } from 'node:child_process'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import readline from 'node:readline'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TOOL_DIR } from '../config.ts'

const SCRIPT = path.join(TOOL_DIR, 'scripts', 'codeTools.mjs')

let server: http.Server
let calls: { url: string; token: string; body: unknown }[]
let child: ChildProcess
let replies: Map<number, Record<string, unknown>>
let waiting: Map<number, (reply: Record<string, unknown>) => void>
let nextId: number

function startScript(url: string, env: Record<string, string> = {}) {
  child = spawn(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      GRILLINGSTONE_SERVER_URL: url,
      GRILLINGSTONE_SESSION_ID: 'sess-1',
      GRILLINGSTONE_SESSION_TOKEN: 'tok-1',
      GRILLINGSTONE_CODE_FOLDER_LABELS: 'app,ui',
      ...env,
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  readline.createInterface({ input: child.stdout! }).on('line', (line) => {
    const reply = JSON.parse(line) as Record<string, unknown>
    const id = reply.id as number
    const resolve = waiting.get(id)
    if (resolve) resolve(reply)
    else replies.set(id, reply)
  })
}

/** Sends one JSON-RPC request and waits for its reply. */
function request(method: string, params: unknown = {}): Promise<Record<string, unknown>> {
  const id = nextId++
  child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  return new Promise((resolve) => {
    const early = replies.get(id)
    if (early) resolve(early)
    else waiting.set(id, resolve)
  })
}

beforeEach(async () => {
  calls = []
  replies = new Map()
  waiting = new Map()
  nextId = 1
  server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      calls.push({ url: req.url ?? '', token: String(req.headers['x-pbi-session-token']), body: JSON.parse(raw) })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ text: 'app: src/App.tsx', isError: false }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  startScript(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
})
afterEach(async () => {
  child.kill()
  await new Promise((resolve) => server.close(resolve))
})

describe('code tools MCP server', () => {
  it('answers initialize with its tools capability, echoing the protocol version', async () => {
    const reply = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 't' },
    })
    expect(reply.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'grillingstone-code' },
    })
  })

  it('lists exactly the three read-only tools, naming the session’s Code Folders', async () => {
    const reply = await request('tools/list')
    const tools = (reply.result as { tools: { name: string; description: string; inputSchema: unknown }[] }).tools
    expect(tools.map((tool) => tool.name)).toEqual(['list_code_files', 'search_code', 'read_code_file'])
    expect(tools[2].description).toContain('app, ui')
    expect(tools[2].inputSchema).toMatchObject({ required: ['folder', 'path'] })
  })

  it('forwards a call to the backend with the session token and returns its text', async () => {
    const reply = await request('tools/call', { name: 'list_code_files', arguments: { folder: 'app' } })
    expect(reply.result).toEqual({ content: [{ type: 'text', text: 'app: src/App.tsx' }], isError: false })
    expect(calls).toEqual([
      { url: '/api/internal/sessions/sess-1/code/list_code_files', token: 'tok-1', body: { folder: 'app' } },
    ])
  })

  it('answers ping, and an unknown method with an error', async () => {
    expect((await request('ping')).result).toEqual({})
    expect((await request('resources/list')).error).toMatchObject({ code: -32601 })
  })
})
