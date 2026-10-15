// Reading Codex app-server notifications: agent messages become chat messages with cards (ADR-0010), and the
// commands, file changes and web searches Codex runs become one-line tool summaries with their outcome.
import path from 'node:path'

import { SUBMIT_TOOL } from '#core/session/cardProtocol.ts'
import { GLOSSARY_FILE } from '#core/session/permissionGuard.ts'
import type { ChatMessage } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'

import { now } from '../services/clock.ts'
import { assistantTextSteps, MAX_COMMAND_PREVIEW, toolStartStep, turnFailedSteps } from './chatMessages.ts'
import type { StreamContext, StreamStep, ToolOutcome } from './streamEvents.ts'

type Item = Record<string, unknown>

/** How a finished command or file change's status reads in the chat; a declined one was refused, not failed. */
const OUTCOME_OF_STATUS: Record<string, ToolOutcome> = { completed: 'ok', declined: 'denied', failed: 'error' }

/** Items shown when they start and updated with their outcome when they end. */
const TOOL_ITEMS = ['commandExecution', 'fileChange', 'dynamicToolCall']

/** What a command prints when the sandbox, not the command itself, stopped it. */
const SANDBOX_REFUSAL = /operation not permitted/i

/** Item fields are untyped JSON; show them only when they are text. */
const text = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback)

/** A path Codex gave, absolute or relative to the Project folder, as the chat shows it. */
const projectRelative = (cwd: string, file: unknown, fallback: string) =>
  path.relative(cwd, path.resolve(cwd, text(file, fallback)))

/** Codex's best-effort reading of what a command does, one per part of a compound command. */
function describeAction(action: Item, cwd: string): string {
  const folder = projectRelative(cwd, action.path, '.') || 'the Project'
  switch (action.type) {
    case 'read':
      return `Read ${folder}`
    case 'search':
      return `Searched the Project for "${text(action.query, '')}"`
    case 'listFiles':
      return `Listed the files in ${folder}`
    default: {
      const firstLine = text(action.command, '').split('\n')[0].slice(0, MAX_COMMAND_PREVIEW)
      return `Ran \`${firstLine}\``
    }
  }
}

function describeCommand(item: Item, cwd: string): string {
  const actions = Array.isArray(item.commandActions) ? (item.commandActions as Item[]) : []
  const fallback = [{ type: 'unknown', command: item.command }]
  const described = (actions.length ? actions : fallback).map((action) => describeAction(action, cwd))
  return described.join(' · ')
}

/** The Project-relative files a file-change item touches. */
function changedFiles(item: Item, cwd: string): string[] {
  const changes = Array.isArray(item.changes) ? (item.changes as Item[]) : []
  return changes.map((change) => projectRelative(cwd, change.path, '?'))
}

function describeFileChange(files: string[]): string {
  if (files.length === 1 && files[0] === GLOSSARY_FILE) return 'Updated the Glossary'
  return `Wrote ${files.join(', ')}`
}

/** The tool message for an item that has just started; a file change remembers its files for its end. */
function startedSteps(item: Item, ctx: StreamContext): StreamStep[] {
  const started = (summary: string, input: Record<string, unknown> = {}) => [
    toolStartStep(String(item.type), String(item.id), input, summary),
  ]
  if (item.type === 'commandExecution') return started(describeCommand(item, ctx.cwd))
  if (item.type === 'fileChange') {
    const files = changedFiles(item, ctx.cwd)
    return started(describeFileChange(files), { files })
  }
  if (item.type === 'dynamicToolCall')
    return started(item.tool === SUBMIT_TOOL ? ctx.submitLabel : `Tried to use ${text(item.tool, 'a tool')}`)
  return []
}

function outcomeOf(item: Item): ToolOutcome {
  // The Guard refuses every backend tool but submit_draft; submit_draft reports success itself, and a refused
  // submission is a call that came back with success false.
  if (item.type === 'dynamicToolCall') {
    if (item.tool !== SUBMIT_TOOL) return 'denied'
    return item.success === true ? 'ok' : 'error'
  }
  if (item.status === 'failed' && SANDBOX_REFUSAL.test(text(item.aggregatedOutput, ''))) return 'denied'
  return OUTCOME_OF_STATUS[String(item.status)] ?? 'error'
}

function toolEndSteps(item: Item, ctx: StreamContext): StreamStep[] {
  const id = String(item.id)
  const tool = ctx.tools.get(id)
  if (!tool) return []
  ctx.tools.delete(id) // an item ends once; nothing needs it after this
  const outcome = outcomeOf(item)
  // The started item named the files; the completed one may not repeat them.
  const files = Array.isArray(tool.input.files) ? (tool.input.files as string[]) : []
  const touchesGlossary = files.includes(GLOSSARY_FILE)
  const glossaryEdited = outcome === 'ok' && touchesGlossary
  return [{ type: 'toolResult', messageId: tool.messageId, outcome, glossaryEdited }]
}

function describeWebSearch(item: Item): string {
  const action = (item.action ?? {}) as Item
  if (action.type === 'openPage' || action.type === 'findInPage') return `Read ${text(action.url, 'a web page')}`
  return `Searched the web for "${text(action.query, text(item.query, ''))}"`
}

/** Codex reports a web search only once it is done, so its message carries the outcome already. */
function webSearchStep(item: Item): StreamStep[] {
  const message: ChatMessage = {
    id: newId('m'),
    at: now(),
    role: 'tool',
    tool: 'webSearch',
    summary: describeWebSearch(item),
    outcome: 'ok',
  }
  return [{ type: 'message', message }]
}

function completedSteps(item: Item, ctx: StreamContext): StreamStep[] {
  if (item.type === 'agentMessage') return assistantTextSteps(item.text)
  if (TOOL_ITEMS.includes(String(item.type))) return toolEndSteps(item, ctx)
  if (item.type === 'webSearch') return webSearchStep(item)
  return []
}

/** The end of a turn, reporting first when Codex ended it with an error. */
function turnSteps(params: Record<string, unknown>): StreamStep[] {
  const turn = (params.turn ?? {}) as Item
  if (turn.status !== 'failed') return [{ type: 'turnEnded' }]
  const turnError = (turn.error ?? {}) as Item
  return turnFailedSteps(`Codex reported an error: ${text(turnError.message, 'the turn failed')}`)
}

/** What one app-server notification means for the Transcript. */
export function readCodexNotification(
  method: string,
  params: Record<string, unknown>,
  ctx: StreamContext,
): StreamStep[] {
  const item = (params.item ?? {}) as Item
  if (method === 'item/started') return startedSteps(item, ctx)
  if (method === 'item/completed') return completedSteps(item, ctx)
  if (method === 'turn/completed') return turnSteps(params)
  return []
}
