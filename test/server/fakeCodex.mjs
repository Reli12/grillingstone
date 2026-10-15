#!/usr/bin/env node
// A stand-in for `codex app-server` in server and browser (e2e/) tests: speaks its JSON-RPC on stdin/stdout and
// answers like a session would. Each turn reads CONTEXT.md and asks one question card; on "Write it now." it
// calls the backend's submit_draft tool with a valid payload for its kind of session (v1 Draft, Proposal or
// Template). A message containing OUTSIDE asks approval to read outside the Project, OTHER_TOOL calls a tool
// the backend never registered, REJECT has turn/start refused, and CRASH makes it die.
// Like Codex it names its thread on thread/start; on thread/resume it keeps the id it is given.
import readline from 'node:readline'

import { fakeSubmission } from './fakeSubmission.mjs'

// `codex login status`: signed in (exit 0), unless a test set FAKE_ASSISTANT_SIGNED_OUT.
if (process.argv[2] === 'login' && process.argv[3] === 'status') {
  if (process.env.FAKE_ASSISTANT_SIGNED_OUT) {
    process.stderr.write('Not logged in\n')
    process.exit(1)
  }
  process.stdout.write('Logged in using ChatGPT\n')
  process.exit(0)
}

const WRITE_NOW = 'Write it now.'
const SUBMIT_TOOL = 'submit_draft'
/** A Template Session's profile writes nothing; a Grilling Session's may write plan/. */
const template = !process.argv.some((arg) => arg.includes('"plan" = "write"'))

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const notify = (method, params) => send({ method, params })

let nextRequestId = 1
/** Server request id → resolver of the client's answer. */
const answers = new Map()
/** Asks the client something (an approval, a tool call) and waits for its answer. */
const ask = (method, params) =>
  new Promise((resolve) => {
    const id = `srv-${nextRequestId++}`
    answers.set(id, resolve)
    send({ id, method, params })
  })

const thread = { id: '', resumed: false, tools: [], firstInput: '' }
let nextItem = 1
const itemId = () => `item-${nextItem++}`

const started = (item) => notify('item/started', { threadId: thread.id, item })
const completed = (item) => notify('item/completed', { threadId: thread.id, item })
const say = (text) => completed({ type: 'agentMessage', id: itemId(), text })

function readGlossary() {
  const id = itemId()
  const read = { type: 'read', command: 'cat CONTEXT.md', name: 'CONTEXT.md', path: `${process.cwd()}/CONTEXT.md` }
  const item = { type: 'commandExecution', id, command: '/bin/zsh -lc "cat CONTEXT.md"', commandActions: [read] }
  started({ ...item, status: 'inProgress' })
  completed({ ...item, status: 'completed', exitCode: 0, aggregatedOutput: '' })
}

async function readOutside(turnId) {
  const id = itemId()
  const read = { type: 'read', command: 'cat ~/.ssh/id_rsa', name: 'id_rsa', path: '/Users/me/.ssh/id_rsa' }
  const item = { type: 'commandExecution', id, command: '/bin/zsh -lc "cat ~/.ssh/id_rsa"', commandActions: [read] }
  started({ ...item, status: 'inProgress' })
  const answer = await ask('item/commandExecution/requestApproval', {
    threadId: thread.id,
    turnId,
    itemId: id,
    startedAtMs: Date.now(),
    command: item.command,
    commandActions: [read],
    reason: 'Read outside the workspace',
  })
  const status = answer.result?.decision === 'accept' ? 'completed' : 'declined'
  completed({ ...item, status })
}

/** Calls a backend tool as Codex does: the item starts, the backend answers, the item ends with the answer. */
async function callTool(turnId, tool, args) {
  const id = itemId()
  const item = { type: 'dynamicToolCall', id, tool, arguments: args }
  started({ ...item, status: 'inProgress' })
  const answer = await ask('item/tool/call', { threadId: thread.id, turnId, callId: id, tool, arguments: args })
  const { success = false, contentItems = [] } = answer.result ?? {}
  completed({ ...item, status: 'completed', success, contentItems })
  return { success, reply: contentItems.map((content) => content.text).join('\n') }
}

async function submit(turnId) {
  if (!thread.tools.some((tool) => tool.name === SUBMIT_TOOL)) {
    say(`No ${SUBMIT_TOOL} tool was registered.`)
    return
  }
  const payload = fakeSubmission(template, thread.firstInput)
  const { success, reply } = await callTool(turnId, SUBMIT_TOOL, { payload })
  say(success ? 'Written.' : `Refused: ${reply}`)
}

async function runTurn(turnId, text) {
  notify('turn/started', { threadId: thread.id, turn: { id: turnId, status: 'inProgress', items: [] } })
  if (!thread.firstInput) {
    thread.firstInput = text
    if (thread.resumed) say('Picking up where we left off.')
  }
  if (text.includes('CRASH')) {
    process.stderr.write('fake codex crashed\n')
    process.exit(3)
  }
  if (text.includes('OUTSIDE')) await readOutside(turnId)
  if (text.includes('OTHER_TOOL')) await callTool(turnId, 'other_tool', {})
  if (text === WRITE_NOW) await submit(turnId)
  else {
    readGlossary()
    say(
      'One question.\n```pbi-question\n{"question": "Who may archive?", "recommended": "Managers", "options": ["Admins"]}\n```',
    )
  }
  notify('turn/completed', { threadId: thread.id, turn: { id: turnId, status: 'completed', items: [] } })
}

/** The client's requests; each is answered with a result or an error. */
const handlers = {
  initialize: (params) => {
    if (!params.capabilities?.experimentalApi) throw new Error('dynamicTools needs capabilities.experimentalApi')
    return { userAgent: 'fake-codex' }
  },
  'thread/start': (params) => {
    Object.assign(thread, { id: `codex-${process.pid}`, tools: params.dynamicTools ?? [] })
    return { thread: { id: thread.id } }
  },
  'thread/resume': (params) => {
    // Codex keeps a thread's dynamic tools with it (its session metadata has dynamic_tools) and restores them
    // on resume, which takes none; this fake runs one process per session, so it assumes the submit tool.
    Object.assign(thread, { id: params.threadId, resumed: true, tools: [{ name: SUBMIT_TOOL }] })
    return { thread: { id: thread.id } }
  },
  'turn/start': (params) => {
    const turnId = `turn-${nextItem++}`
    const text = params.input.map((input) => input.text).join('\n')
    if (text.includes('REJECT')) throw new Error('turn rejected by fake codex')
    // Answer first, as app-server does, then stream the turn.
    setImmediate(() => void runTurn(turnId, text))
    return { turn: { id: turnId, status: 'inProgress', items: [] } }
  },
}

for await (const line of readline.createInterface({ input: process.stdin })) {
  const message = JSON.parse(line)
  if (message.method === undefined) {
    // The client's answer to one of our requests.
    answers.get(message.id)?.(message)
    answers.delete(message.id)
    continue
  }
  if (message.id === undefined) continue // a notification, such as "initialized"
  const handler = handlers[message.method]
  try {
    if (!handler) throw new Error(`fake codex does not know ${message.method}`)
    send({ id: message.id, result: handler(message.params ?? {}) })
  } catch (error) {
    send({ id: message.id, error: { code: -32600, message: error.message } })
  }
}
