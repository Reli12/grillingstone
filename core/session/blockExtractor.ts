// Extracts question cards and the Ready Check from Claude's text (ADR-0010). Anything that is not a
// complete, well-formed block stays visible as plain text — never dropped silently.
import { QUESTION_FENCE, READY_FENCE } from '#core/session/cardProtocol.ts'

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'question'; question: string; recommended: string; options: string[] }
  | { type: 'ready'; summary: string }

const BLOCK = /```[ \t]*(pbi-[\w-]+)[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*(?:\n|$)/g

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

function parseBlock(kind: string, json: string): Segment | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (kind === QUESTION_FENCE && nonEmpty(d.question) && nonEmpty(d.recommended)) {
    const options = Array.isArray(d.options) ? d.options.filter(nonEmpty).map((o) => o.trim()) : []
    return { type: 'question', question: d.question.trim(), recommended: d.recommended.trim(), options }
  }
  if (kind === READY_FENCE) return { type: 'ready', summary: nonEmpty(d.summary) ? d.summary.trim() : '' }
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
  for (const m of text.matchAll(BLOCK)) {
    const block = parseBlock(m[1], m[2])
    pending += text.slice(last, m.index)
    if (block) {
      flush()
      segments.push(block)
    } else pending += m[0]
    last = m.index + m[0].length
  }
  pending += text.slice(last)
  flush()
  return segments
}
