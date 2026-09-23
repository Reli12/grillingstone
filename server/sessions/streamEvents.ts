// Reading Claude Code's stream-json output: text becomes chat messages with cards (ADR-0010), tool calls
// become one-line summaries whose outcome is filled in when the result arrives.
import path from 'node:path'
import { extractBlocks } from '#core/session/blockExtractor.ts'
import type { ChatMessage } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { SUBMIT_SCRIPT } from '../config.ts'

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
  /** Claude Code named its conversation. */
  | { type: 'claudeSession'; id: string }

const now = () => new Date().toISOString()

/** A one-line summary of a tool call for the chat, or null for tools not worth showing. */
export function describeTool(name: string, input: Record<string, unknown>, { cwd, submitLabel }: Pick<StreamContext, 'cwd' | 'submitLabel'>): string | null {
  const rel = (p: unknown) => (typeof p === 'string' ? path.relative(cwd, p) || '.' : '?')
  switch (name) {
    case 'Read':
      return `Read ${rel(input.file_path)}`
    case 'Grep':
      return `Searched the Project for "${String(input.pattern ?? '')}"`
    case 'Glob':
      return `Looked for files matching ${String(input.pattern ?? '')}`
    case 'Edit':
    case 'Write':
    case 'MultiEdit': {
      const file = rel(input.file_path)
      return file === 'CONTEXT.md' ? 'Updated the Glossary' : `Wrote ${file}`
    }
    case 'WebSearch':
      return `Searched the web for "${String(input.query ?? '')}"`
    case 'WebFetch':
      return `Read ${String(input.url ?? 'a web page')}`
    case 'Bash': {
      const command = String(input.command ?? '')
      if (command.includes(SUBMIT_SCRIPT)) return submitLabel
      return `Tried to run \`${command.split('\n')[0].slice(0, 80)}\``
    }
    case 'Skill':
      return `Loaded the ${String(input.skill ?? '')} skill`
    case 'TodoWrite':
      return null
    default:
      return `Tried to use ${name}`
  }
}

/** What one stream-json event means for the Transcript. */
export function readStreamEvent(event: Record<string, unknown>, ctx: StreamContext): StreamStep[] {
  const message = event.message as { content?: unknown } | undefined
  const blocks = Array.isArray(message?.content) ? (message!.content as Record<string, unknown>[]) : []
  const steps: StreamStep[] = []

  if (event.type === 'system') {
    if (event.subtype === 'init' && typeof event.session_id === 'string') steps.push({ type: 'claudeSession', id: event.session_id })
  } else if (event.type === 'assistant' && !event.parent_tool_use_id) {
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        steps.push({ type: 'message', message: { id: newId('m'), at: now(), role: 'claude', segments: extractBlocks(b.text) } })
      } else if (b.type === 'tool_use') {
        const name = String(b.name)
        const input = (b.input ?? {}) as Record<string, unknown>
        const summary = describeTool(name, input, ctx)
        if (!summary) continue
        const msg: ChatMessage = { id: newId('m'), at: now(), role: 'tool', tool: name, summary, toolUseId: String(b.id) }
        steps.push({ type: 'message', message: msg, toolUseId: String(b.id), tool: { name, input, messageId: msg.id } })
      }
    }
  } else if (event.type === 'user') {
    for (const b of blocks) {
      if (b.type !== 'tool_result') continue
      const tool = ctx.tools.get(String(b.tool_use_id))
      if (!tool) continue
      const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
      const outcome: ToolOutcome = b.is_error ? (/hook error|denied|not allowed|not available/i.test(text) ? 'denied' : 'error') : 'ok'
      const refused = outcome === 'ok' && tool.name === 'Bash' && text.includes('REFUSED')
      const glossaryEdited = outcome === 'ok' && ['Edit', 'Write', 'MultiEdit'].includes(tool.name) && path.basename(String(tool.input.file_path)) === 'CONTEXT.md'
      steps.push({ type: 'toolResult', messageId: tool.messageId, outcome: refused ? 'error' : outcome, glossaryEdited })
    }
  } else if (event.type === 'result') {
    if (event.is_error) {
      const detail = typeof event.result === 'string' ? event.result : String(event.subtype ?? 'error')
      steps.push({ type: 'message', message: { id: newId('m'), at: now(), role: 'system', tone: 'error', text: `Claude Code reported an error: ${detail}` } })
    }
    steps.push({ type: 'turnEnded' })
  }
  return steps
}
