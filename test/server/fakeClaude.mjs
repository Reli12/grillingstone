#!/usr/bin/env node
// A stand-in for `claude -p` in server and browser (e2e/) tests: reads stream-json user messages on stdin and answers like a
// session would. It asks one question card; on "Write it now." it writes a valid payload file for its kind of session
// (v1 Draft, Proposal or Template) and runs the real submit script. A message containing CRASH makes it die.
// A turn with Images (a content array) is answered with one extra line, "Received image blocks: Image 1 (image/png, …)".
// Like Claude Code it names its session in an init event; with --resume it keeps the name it is given.
// "READ CODE" makes it start the MCP server its --mcp-config names (the code tools, ADR-0016), speak MCP to it like
// Claude Code would, and report each call's result on its own line — or "NO CODE TOOLS" without an MCP config.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { methodSkeleton } from '#core/template/templateValidator.ts'
import { validPbiContent } from '#core/testing/fixtures.ts'

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
const say = (text) => emit({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
const done = () => emit({ type: 'result', is_error: false })
let seed = ''
const resumeAt = process.argv.indexOf('--resume')
const claudeSessionId = resumeAt >= 0 ? process.argv[resumeAt + 1] : `claude-${process.pid}`

function payload() {
  if (process.env.GRILLINGSTONE_GUARD_MODE === 'template')
    return {
      name: 'Spike PBI',
      method: methodSkeleton('Spike PBI'),
      sections: [
        {
          key: 'goal',
          heading: 'Goal',
          shape: 'prose',
          locked: true,
          guidance: 'What to find out',
          target: 'System.Description',
        },
      ],
    }
  const current = /## Current Draft[^\n]*\n```json\n([\s\S]*?)\n```/.exec(seed)
  if (!current) return validPbiContent()
  const prose = JSON.parse(current[1]).sections.find((s) => typeof s.body === 'string' && !s.entries)
  return {
    changes: [
      {
        kind: 'replaceSection',
        sectionId: prose.id,
        body: `${prose.body} (revised)`,
        label: `${prose.heading} · revise`,
      },
    ],
  }
}

/** Starts the configured MCP server, makes the code tool calls a session might, and returns one line per result. */
async function readCodeThroughMcp() {
  const at = process.argv.indexOf('--mcp-config')
  if (at < 0) return 'NO CODE TOOLS'
  const [config] = Object.values(JSON.parse(process.argv[at + 1]).mcpServers)
  const child = spawn(config.command, config.args, { env: process.env, stdio: ['pipe', 'pipe', 'inherit'] })
  const pending = new Map()
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    const reply = JSON.parse(line)
    pending.get(reply.id)?.(reply)
  })
  let id = 0
  const request = (method, params) =>
    new Promise((resolve) => {
      pending.set(++id, resolve)
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  const call = async (name, args) => {
    const { result } = await request('tools/call', { name, arguments: args })
    return `${result.isError ? 'REFUSED' : 'OK'} ${result.content[0].text.replaceAll('\n', ' | ')}`
  }
  await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fake' } })
  const folder = (await request('tools/list', {})).result.tools[0].description.match(/\(([^),]+)/)[1]
  const lines = [
    `LIST ${await call('list_code_files', { folder })}`,
    `EXAMPLE ${await call('read_code_file', { folder, path: '.env.example' })}`,
    `ENV ${await call('read_code_file', { folder, path: '.env' })}`,
    `SEARCH ${await call('search_code', { pattern: 'TOKEN' })}`,
  ]
  child.kill()
  return lines.join('\n')
}

const IMAGE_LABEL = /^Image (\d+):$/

/** A turn's content is plain text, or (when it carries Images) an array of text and image blocks. */
function readContent(content) {
  if (typeof content === 'string') return { text: content, images: [] }
  const text = content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  const images = []
  let label = ''
  for (const block of content) {
    if (block.type === 'text') label = IMAGE_LABEL.test(block.text) ? block.text.slice(0, -1) : ''
    if (block.type === 'image') {
      const { media_type: mediaType, data } = block.source
      images.push(`${label || 'Image ?'} (${mediaType}, ${data.length} base64 characters)`)
    }
  }
  return { text, images }
}

for await (const line of readline.createInterface({ input: process.stdin })) {
  const { text, images } = readContent(JSON.parse(line).message.content)
  if (!seed) {
    seed = text
    emit({ type: 'system', subtype: 'init', session_id: claudeSessionId })
    if (resumeAt >= 0) say('Picking up where we left off.')
  }
  if (text.includes('READ CODE')) {
    say(await readCodeThroughMcp())
    done()
    continue
  }
  if (text.includes('CRASH')) {
    process.stderr.write('fake claude crashed\n')
    process.exit(3)
  }
  if (text !== 'Write it now.') {
    // Lets tests see what reached the child process: one line naming each image block it received.
    if (images.length) say(`Received image blocks: ${images.join('; ')}.`)
    emit({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: `${process.cwd()}/CONTEXT.md` } },
        ],
      },
    })
    emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read-1', content: 'ok' }] } })
    say(
      'One question.\n```pbi-question\n{"question": "Who may archive?", "recommended": "Managers", "options": ["Admins"]}\n```',
    )
    done()
    continue
  }
  const script = process.env.GRILLINGSTONE_SUBMIT_SCRIPT
  // Like a real session: write the payload file first, then run the bare submit command.
  const payloadPath = path.join(process.cwd(), '.submit', `${process.env.GRILLINGSTONE_SESSION_ID}.json`)
  fs.mkdirSync(path.dirname(payloadPath), { recursive: true })
  fs.writeFileSync(payloadPath, JSON.stringify(payload()))
  emit({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', id: 'payload-1', name: 'Write', input: { file_path: payloadPath, content: '…' } },
        { type: 'tool_use', id: 'submit-1', name: 'Bash', input: { command: `node "${script}"` } },
      ],
    },
  })
  const run = spawnSync(process.execPath, [script], { env: process.env, encoding: 'utf8' })
  emit({
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 'submit-1', content: run.stdout, is_error: run.status !== 0 }],
    },
  })
  say(run.status === 0 ? 'Written.' : 'Refused.')
  done()
}
