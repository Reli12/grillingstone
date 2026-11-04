#!/usr/bin/env node
// The code tools MCP server (ADR-0016), started once per Grilling Session that reads Code Folders. It speaks MCP
// over stdio (newline-delimited JSON-RPC) and offers three read-only tools. It never touches a Code Folder itself:
// each call goes to the backend, authenticated by the session's token, which resolves the session's own Code
// Folders and applies the Excluded File policy before anything comes back. No other server is reachable, since
// sessions run with --strict-mcp-config.
import readline from 'node:readline'

const SESSION_TOKEN_HEADER = 'x-pbi-session-token'
const DEFAULT_PROTOCOL = '2025-06-18'

const server = process.env.GRILLINGSTONE_SERVER_URL
const sessionId = process.env.GRILLINGSTONE_SESSION_ID
const token = process.env.GRILLINGSTONE_SESSION_TOKEN
const labels = (process.env.GRILLINGSTONE_CODE_FOLDER_LABELS ?? '').split(',').filter(Boolean)
const available = labels.length ? labels.join(', ') : 'none'

const folder = {
  type: 'string',
  description: `The Code Folder's label: ${available}.`,
}

const TOOLS = [
  {
    name: 'list_code_files',
    description: `List the readable files of a Code Folder (${available}), optionally within a subfolder or matching a glob such as "*.tsx" or "src/devices/**". Excluded Files are never listed.`,
    inputSchema: {
      type: 'object',
      properties: {
        folder,
        subfolder: { type: 'string', description: 'A folder inside the Code Folder, e.g. "src/devices".' },
        glob: { type: 'string', description: 'Only files matching this glob.' },
        limit: { type: 'number', description: 'At most this many files (default 500).' },
      },
      required: ['folder'],
    },
  },
  {
    name: 'search_code',
    description: `Search the readable files of the Code Folders (${available}) for a regular expression, case-insensitively. Omit folder to search all of them. Each match is "label: path:line: text". Excluded Files are never searched.`,
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'A regular expression (or plain text).' },
        folder: { ...folder, description: `${folder.description} Omit to search every Code Folder.` },
        glob: { type: 'string', description: 'Only files matching this glob, e.g. "*.ts".' },
        limit: { type: 'number', description: 'At most this many matches (default 100).' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'read_code_file',
    description: `Read one file of a Code Folder (${available}), with line numbers, optionally a line range. Reading an Excluded File is refused.`,
    inputSchema: {
      type: 'object',
      properties: {
        folder,
        path: {
          type: 'string',
          description: 'The file, relative to the Code Folder, e.g. "src/devices/DeviceList.tsx".',
        },
        startLine: { type: 'number', description: 'First line to read (1-based).' },
        endLine: { type: 'number', description: 'Last line to read.' },
      },
      required: ['folder', 'path'],
    },
  },
]

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
const textResult = (text, isError) => ({ content: [{ type: 'text', text }], isError })

async function callTool(name, args) {
  if (!server || !sessionId || !token)
    return textResult('The code tools only work inside a Grilling Stone session.', true)
  if (!TOOLS.some((tool) => tool.name === name)) return textResult(`There is no code tool "${name}".`, true)
  try {
    const res = await fetch(`${server}/api/internal/sessions/${encodeURIComponent(sessionId)}/code/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SESSION_TOKEN_HEADER]: token },
      body: JSON.stringify(args ?? {}),
    })
    // A non-JSON answer (a crash page) has no text to show; its status is the message.
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return textResult(body.error ?? `HTTP ${res.status}`, true)
    return textResult(String(body.text ?? ''), !!body.isError)
  } catch (error) {
    return textResult(`Could not reach the Grilling Stone backend: ${error.message}`, true)
  }
}

async function handle({ id, method, params }) {
  // A notification (no id), e.g. notifications/initialized, needs no answer.
  if (id === undefined || id === null) return
  switch (method) {
    case 'initialize':
      return send({
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: 'grillingstone-code', version: '1.0.0' },
        },
      })
    case 'ping':
      return send({ id, result: {} })
    case 'tools/list':
      return send({ id, result: { tools: TOOLS } })
    case 'tools/call':
      return send({ id, result: await callTool(params?.name, params?.arguments) })
    default:
      return send({ id, error: { code: -32601, message: `Method not found: ${method}` } })
  }
}

for await (const line of readline.createInterface({ input: process.stdin })) {
  if (!line.trim()) continue
  let message
  try {
    message = JSON.parse(line)
  } catch {
    send({ id: null, error: { code: -32700, message: 'Parse error' } })
    continue
  }
  // Calls run concurrently; each answers with its own id.
  void handle(message)
}
