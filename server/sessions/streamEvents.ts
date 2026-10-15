// Reading Claude Code's stream-json output: text becomes chat messages with cards (ADR-0010), tool calls
// become one-line summaries whose outcome is filled in when the result arrives.
import path from 'node:path'

import { GLOSSARY_FILE } from '#core/session/permissionGuard.ts'
import type { ChatMessage } from '#core/session/sessionTypes.ts'

import { SUBMIT_SCRIPT } from '../config.ts'
import { assistantTextSteps, MAX_COMMAND_PREVIEW, toolStartStep, turnFailedSteps } from './chatMessages.ts'

export type ToolOutcome = 'ok' | 'denied' | 'error'

export interface KnownTool {
  name: string
  input: Record<string, unknown>
  messageId: string
}

export interface StreamContext {
  cwd: string
  submitLabel: string
  /** tool_use id → the tool message showing it. */
  tools: Map<string, KnownTool>
}

export type StreamStep =
  | { type: 'message'; message: ChatMessage; toolUseId?: string; tool?: KnownTool }
  | { type: 'toolResult'; messageId: string; outcome: ToolOutcome; glossaryEdited: boolean }
  | { type: 'turnEnded' }
  /** The Assistant named its conversation. */
  | { type: 'conversation'; id: string }

/** The tools that write files; one of them touching CONTEXT.md is an edit to the Glossary. */
const FILE_WRITING_TOOLS = ['Edit', 'Write', 'MultiEdit']

/** Tool-result text that means the Permission Guard (or Claude Code) refused the call rather than it failing. */
const DENIED_RESULT = /hook error|denied|not allowed|not available/i

/** What the submit script prints when the backend refused the submission; the call itself "succeeded". */
const SUBMISSION_REFUSED = 'REFUSED'

/** Tool inputs and stream fields are untyped JSON; show them only when they are text. */
const text = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)

/** A one-line summary of a tool call for the chat, or null for tools not worth showing. */
export function describeTool(
  name: string,
  input: Record<string, unknown>,
  { cwd, submitLabel }: Pick<StreamContext, 'cwd' | 'submitLabel'>,
): string | null {
  const relative = (file: unknown) => (typeof file === 'string' ? path.relative(cwd, file) || '.' : '?')
  switch (name) {
    case 'Read':
      return `Read ${relative(input.file_path)}`
    case 'Grep':
      return `Searched the Project for "${text(input.pattern, '')}"`
    case 'Glob':
      return `Looked for files matching ${text(input.pattern, '')}`
    case 'Edit':
    case 'Write':
    case 'MultiEdit': {
      const file = relative(input.file_path)
      return file === GLOSSARY_FILE ? 'Updated the Glossary' : `Wrote ${file}`
    }
    case 'WebSearch':
      return `Searched the web for "${text(input.query, '')}"`
    case 'WebFetch':
      return `Read ${text(input.url, 'a web page')}`
    case 'Bash': {
      const command = text(input.command, '')
      if (command.includes(SUBMIT_SCRIPT)) return submitLabel
      const firstLine = command.split('\n')[0].slice(0, MAX_COMMAND_PREVIEW)
      return `Tried to run \`${firstLine}\``
    }
    case 'Skill':
      return `Loaded the ${text(input.skill, '')} skill`
    case 'TodoWrite':
      return null
    default:
      return `Tried to use ${name}`
  }
}

type Block = Record<string, unknown>

/** The content blocks of an assistant or user event; anything else has none. */
function contentBlocks(event: Record<string, unknown>): Block[] {
  const message = event.message as { content?: unknown } | undefined
  return Array.isArray(message?.content) ? (message.content as Block[]) : []
}

function toolUseSteps(block: Block, ctx: StreamContext): StreamStep[] {
  const name = String(block.name)
  const input = (block.input ?? {}) as Record<string, unknown>
  const summary = describeTool(name, input, ctx)
  return summary ? [toolStartStep(name, String(block.id), input, summary)] : []
}

/** Claude's own turn: its text and the tool calls worth showing. */
function assistantSteps(blocks: Block[], ctx: StreamContext): StreamStep[] {
  return blocks.flatMap((block) => {
    if (block.type === 'text') return assistantTextSteps(block.text)
    if (block.type === 'tool_use') return toolUseSteps(block, ctx)
    return []
  })
}

function toolOutcome(block: Block, resultText: string): ToolOutcome {
  if (!block.is_error) return 'ok'
  return DENIED_RESULT.test(resultText) ? 'denied' : 'error'
}

function toolResultStep(block: Block, tool: KnownTool): StreamStep {
  const resultText = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '')
  const outcome = toolOutcome(block, resultText)
  const refused = outcome === 'ok' && tool.name === 'Bash' && resultText.includes(SUBMISSION_REFUSED)
  const glossaryEdited =
    outcome === 'ok' &&
    FILE_WRITING_TOOLS.includes(tool.name) &&
    path.basename(String(tool.input.file_path)) === GLOSSARY_FILE
  return {
    type: 'toolResult',
    messageId: tool.messageId,
    outcome: refused ? 'error' : outcome,
    glossaryEdited,
  }
}

/** Tool results coming back, for the tool calls the chat shows. */
function userSteps(blocks: Block[], ctx: StreamContext): StreamStep[] {
  const steps: StreamStep[] = []
  for (const block of blocks) {
    if (block.type !== 'tool_result') continue
    const tool = ctx.tools.get(String(block.tool_use_id))
    if (tool) steps.push(toolResultStep(block, tool))
  }
  return steps
}

/** The end of a turn, reporting first when Claude Code ended it with an error. */
function resultSteps(event: Record<string, unknown>): StreamStep[] {
  if (!event.is_error) return [{ type: 'turnEnded' }]
  const detail = typeof event.result === 'string' ? event.result : text(event.subtype, 'error')
  return turnFailedSteps(`Claude Code reported an error: ${detail}`)
}

/** What one stream-json event means for the Transcript. */
export function readStreamEvent(event: Record<string, unknown>, ctx: StreamContext): StreamStep[] {
  if (event.type === 'system') {
    // The init event names Claude Code's conversation, which a Continuation resumes later.
    if (event.subtype === 'init' && typeof event.session_id === 'string')
      return [{ type: 'conversation', id: event.session_id }]
    return []
  }
  // Output of sub-agents carries a parent_tool_use_id; only the main conversation reaches the chat.
  if (event.type === 'assistant' && !event.parent_tool_use_id) return assistantSteps(contentBlocks(event), ctx)
  if (event.type === 'user') return userSteps(contentBlocks(event), ctx)
  if (event.type === 'result') return resultSteps(event)
  return []
}
