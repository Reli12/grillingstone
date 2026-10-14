// Extracts question cards and the Ready Check from Claude's text (ADR-0010). Anything that is not a
// complete, well-formed block stays visible as plain text — never dropped silently.
import { QUESTION_FENCE, READY_FENCE } from '#core/session/cardProtocol.ts'

export type Segment =
  | { type: 'text'; text: string }
  // No recommendation on questions about observed facts: only the human knows the answer.
  | { type: 'question'; question: string; recommended?: string; options: string[] }
  | { type: 'ready'; summary: string }

// A fenced ```pbi-<kind> block on its own lines, capturing the kind and the JSON between the fences.
const BLOCK = /```[ \t]*(pbi-[\w-]+)[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*(?:\n|$)/g

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

function parseBlock(kind: string, json: string): Segment | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    // Broken JSON is not a card: returning null keeps the block visible as plain text.
    return null
  }
  if (!data || typeof data !== 'object') return null
  const fields = data as Record<string, unknown>
  if (kind === QUESTION_FENCE && nonEmpty(fields.question)) {
    const options = Array.isArray(fields.options) ? fields.options.filter(nonEmpty).map((option) => option.trim()) : []
    const question = fields.question.trim()
    if (!nonEmpty(fields.recommended)) return { type: 'question', question, options }
    return { type: 'question', question, recommended: fields.recommended.trim(), options }
  }
  if (kind === READY_FENCE) return { type: 'ready', summary: nonEmpty(fields.summary) ? fields.summary.trim() : '' }
  return null
}

export function extractBlocks(text: string): Segment[] {
  const segments: Segment[] = []
  let pending = ''
  let last = 0
  const flush = () => {
    if (pending.trim()) segments.push({ type: 'text', text: pending.trim() })
    pending = ''
  }
  for (const match of text.matchAll(BLOCK)) {
    const [whole, kind, json] = match
    const block = parseBlock(kind, json)
    pending += text.slice(last, match.index)
    if (block) {
      flush()
      segments.push(block)
    } else pending += whole
    last = match.index + whole.length
  }
  pending += text.slice(last)
  flush()
  return segments
}
