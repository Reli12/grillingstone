// The chat messages an Assistant's steps carry, built one way for both readers (streamEvents.ts for Claude
// Code, codexEvents.ts for Codex) and the Supervisor, so every message has the same shape.
import { extractBlocks } from '#core/session/blockExtractor.ts'
import type { ChatMessage } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'

import { now } from '../services/clock.ts'
import type { KnownTool, StreamStep } from './streamEvents.ts'

/** Longest slice of a shell command shown in a tool summary. */
export const MAX_COMMAND_PREVIEW = 80

export const systemMessage = (text: string, tone?: 'success' | 'error'): ChatMessage => ({
  id: newId('m'),
  at: now(),
  role: 'system',
  ...(tone ? { tone } : {}),
  text,
})

/** The Assistant's own words, with their cards; blank text shows nothing. */
export function assistantTextSteps(text: unknown): StreamStep[] {
  if (typeof text !== 'string' || !text.trim()) return []
  const message: ChatMessage = { id: newId('m'), at: now(), role: 'claude', segments: extractBlocks(text) }
  return [{ type: 'message', message }]
}

/** A tool message for a call that has just started, remembered so its result can fill in the outcome. */
export function toolStartStep(name: string, toolUseId: string, input: Record<string, unknown>, summary: string) {
  const message: ChatMessage = { id: newId('m'), at: now(), role: 'tool', tool: name, summary, toolUseId }
  const tool: KnownTool = { name, input, messageId: message.id }
  return { type: 'message', message, toolUseId, tool } satisfies StreamStep
}

/** The end of a turn the Assistant ended with an error: the error first, then the turn's end. */
export const turnFailedSteps = (text: string): StreamStep[] => [
  { type: 'message', message: systemMessage(text, 'error') },
  { type: 'turnEnded' },
]
