// Reading and editing a Project Glossary (CONTEXT.md, in the grill-with-docs format) term by term,
// leaving every other part of the document exactly as Claude or the human wrote it.

export interface GlossaryTerm {
  term: string
  definition: string
  avoid: string
}

interface Located extends GlossaryTerm {
  /** Line range [start, end) of the term block. */
  start: number
  end: number
}

const TERM = /^\*\*([^*]+?)(?::\*\*|\*\*:)\s*(.*)$/
const AVOID = /^_Avoid_:\s*(.*)$/

function languageRange(lines: string[]): [number, number] | null {
  const start = lines.findIndex((l) => /^##\s+Language\s*$/.test(l))
  if (start < 0) return null
  const next = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  return [start + 1, next < 0 ? lines.length : next]
}

function locate(md: string): { lines: string[]; terms: Located[]; range: [number, number] | null } {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const range = languageRange(lines)
  const terms: Located[] = []
  if (!range) return { lines, terms, range }
  let i = range[0]
  while (i < range[1]) {
    const m = TERM.exec(lines[i])
    if (!m) {
      i++
      continue
    }
    let j = i + 1
    const definition: string[] = m[2].trim() ? [m[2].trim()] : []
    let avoid = ''
    while (j < range[1] && lines[j].trim() !== '' && !TERM.test(lines[j]) && !/^#/.test(lines[j])) {
      const a = AVOID.exec(lines[j])
      if (a) avoid = a[1].trim()
      else definition.push(lines[j].trim())
      j++
    }
    terms.push({ term: m[1].trim(), definition: definition.join(' '), avoid, start: i, end: j })
    i = j
  }
  return { lines, terms, range }
}

export const parseGlossary = (md: string): GlossaryTerm[] =>
  locate(md).terms.map(({ term, definition, avoid }) => ({ term, definition, avoid }))

const termLines = (t: GlossaryTerm) => [
  `**${t.term.trim()}**:`,
  t.definition.trim() || '…',
  ...(t.avoid.trim() ? [`_Avoid_: ${t.avoid.trim()}`] : []),
]

export function updateTerm(md: string, index: number, t: GlossaryTerm): string {
  const { lines, terms } = locate(md)
  const at = terms[index]
  if (!at) throw new Error(`No Glossary term #${index}`)
  lines.splice(at.start, at.end - at.start, ...termLines(t))
  return lines.join('\n')
}

export function removeTerm(md: string, index: number): string {
  const { lines, terms } = locate(md)
  const at = terms[index]
  if (!at) throw new Error(`No Glossary term #${index}`)
  const end = lines[at.end] === '' ? at.end + 1 : at.end
  lines.splice(at.start, end - at.start)
  return lines.join('\n')
}

export function addTerm(md: string, t: GlossaryTerm, projectName = 'Glossary'): string {
  if (!md.trim()) return `# ${projectName}\n\n## Language\n\n${termLines(t).join('\n')}\n`
  const { lines, range } = locate(md)
  if (!range) return `${md.replace(/\s*$/, '')}\n\n## Language\n\n${termLines(t).join('\n')}\n`
  let at = range[1]
  while (at > range[0] && lines[at - 1].trim() === '') at--
  lines.splice(at, 0, '', ...termLines(t), ...(range[1] < lines.length ? [''] : []))
  return lines.join('\n')
}

/** Everything after a leading top-level `# Title` line: a starting Glossary's title is always its Project's name. */
export function withoutTitle(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const first = lines.findIndex((l) => l.trim() !== '')
  if (first >= 0 && /^#\s/.test(lines[first])) lines.splice(0, first + 1)
  else lines.splice(0, Math.max(first, 0))
  return lines.join('\n').replace(/^\n+/, '')
}

/** A new Project's Glossary from text the human brought or copied, in any format; '' when there is nothing. */
export function startingGlossary(projectName: string, text: string): string {
  const body = withoutTitle(text).trimEnd()
  return body ? `# ${projectName.trim()}\n\n${body}\n` : ''
}
