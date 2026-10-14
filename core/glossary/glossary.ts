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

// A term line: "**Term**:" or "**Term:**", capturing the term and any definition text after it.
const TERM = /^\*\*([^*]+?)(?::\*\*|\*\*:)\s*(.*)$/
// An "_Avoid_: …" line, capturing the words to avoid.
const AVOID = /^_Avoid_:\s*(.*)$/
// The "## Language" heading that holds the terms.
const LANGUAGE_HEADING = /^##\s+Language\s*$/
// Any second-level heading: the end of the Language section.
const SECOND_LEVEL_HEADING = /^##\s/
// Any heading at all: the end of a term block.
const ANY_HEADING = /^#/
// A top-level "# Title" heading.
const TOP_LEVEL_HEADING = /^#\s/
// Windows line endings, normalised to "\n" before splitting into lines.
const CRLF = /\r\n/g
// Blank lines at the very start of a document.
const LEADING_NEWLINES = /^\n+/

const PLACEHOLDER_DEFINITION = '…'
const DEFAULT_PROJECT_NAME = 'Glossary'

const toLines = (md: string) => md.replace(CRLF, '\n').split('\n')

function languageRange(lines: string[]): [number, number] | null {
  const start = lines.findIndex((line) => LANGUAGE_HEADING.test(line))
  if (start < 0) return null
  const next = lines.findIndex((line, i) => i > start && SECOND_LEVEL_HEADING.test(line))
  const end = next < 0 ? lines.length : next
  return [start + 1, end]
}

/** A term block runs until a blank line, the next term, a heading, or the end of the Language section. */
const continuesTermBlock = (line: string) => line.trim() !== '' && !TERM.test(line) && !ANY_HEADING.test(line)

/** Reads the term block whose term line is at `start`; `rangeEnd` is the end of the Language section. */
function readTermBlock(lines: string[], start: number, rangeEnd: number, termMatch: RegExpExecArray): Located {
  const [, term, firstLine] = termMatch
  const definition: string[] = firstLine.trim() ? [firstLine.trim()] : []
  let avoid = ''
  let end = start + 1
  while (end < rangeEnd && continuesTermBlock(lines[end])) {
    const avoidMatch = AVOID.exec(lines[end])
    if (avoidMatch) avoid = avoidMatch[1].trim()
    else definition.push(lines[end].trim())
    end++
  }
  return { term: term.trim(), definition: definition.join(' '), avoid, start, end }
}

function locate(md: string): { lines: string[]; terms: Located[]; range: [number, number] | null } {
  const lines = toLines(md)
  const range = languageRange(lines)
  const terms: Located[] = []
  if (!range) return { lines, terms, range }
  let i = range[0]
  while (i < range[1]) {
    const termMatch = TERM.exec(lines[i])
    if (!termMatch) {
      i++
      continue
    }
    const located = readTermBlock(lines, i, range[1], termMatch)
    terms.push(located)
    i = located.end
  }
  return { lines, terms, range }
}

export const parseGlossary = (md: string): GlossaryTerm[] =>
  locate(md).terms.map(({ term, definition, avoid }) => ({ term, definition, avoid }))

/** Whether two term names are the same, ignoring case and surrounding space. */
export const sameName = (one: string, other: string) => one.trim().toLowerCase() === other.trim().toLowerCase()

/** The index of the first term with this name (ignoring case), or -1 when there is none. */
export const findTerm = (md: string, name: string): number =>
  parseGlossary(md).findIndex((glossaryTerm) => sameName(glossaryTerm.term, name))

/** Whether the term, its definition or its words to avoid contain the query, ignoring case; a blank query matches all. */
export function matchesTerm(glossaryTerm: GlossaryTerm, query: string): boolean {
  const needle = query.trim().toLowerCase()
  const { term, definition, avoid } = glossaryTerm
  return [term, definition, avoid].some((field) => field.toLowerCase().includes(needle))
}

/** A stable element id for a term: one per name, ignoring case and surrounding space, as `findTerm` matches. */
export const termAnchor = (name: string) => `term-${encodeURIComponent(name.trim().toLowerCase())}`

const termLines = (glossaryTerm: GlossaryTerm) => {
  const avoid = glossaryTerm.avoid.trim()
  return [
    `**${glossaryTerm.term.trim()}**:`,
    glossaryTerm.definition.trim() || PLACEHOLDER_DEFINITION,
    ...(avoid ? [`_Avoid_: ${avoid}`] : []),
  ]
}

export function updateTerm(md: string, index: number, glossaryTerm: GlossaryTerm): string {
  const { lines, terms } = locate(md)
  const at = terms[index]
  if (!at) throw new Error(`No Glossary term #${index}`)
  lines.splice(at.start, at.end - at.start, ...termLines(glossaryTerm))
  return lines.join('\n')
}

export function removeTerm(md: string, index: number): string {
  const { lines, terms } = locate(md)
  const at = terms[index]
  if (!at) throw new Error(`No Glossary term #${index}`)
  // Take the blank line after the block with it, so removing a term leaves no double gap.
  const end = lines[at.end] === '' ? at.end + 1 : at.end
  lines.splice(at.start, end - at.start)
  return lines.join('\n')
}

export function addTerm(md: string, glossaryTerm: GlossaryTerm, projectName = DEFAULT_PROJECT_NAME): string {
  const newTerm = termLines(glossaryTerm).join('\n')
  if (!md.trim()) return `# ${projectName}\n\n## Language\n\n${newTerm}\n`
  const { lines, range } = locate(md)
  if (!range) return `${md.trimEnd()}\n\n## Language\n\n${newTerm}\n`
  // Insert after the last non-blank line of the Language section.
  let at = range[1]
  while (at > range[0] && lines[at - 1].trim() === '') at--
  const gapBeforeNextSection = range[1] < lines.length ? [''] : []
  lines.splice(at, 0, '', ...termLines(glossaryTerm), ...gapBeforeNextSection)
  return lines.join('\n')
}

/** Everything after a leading top-level `# Title` line: a starting Glossary's title is always its Project's name. */
export function withoutTitle(md: string): string {
  const lines = toLines(md)
  const first = lines.findIndex((line) => line.trim() !== '')
  if (first >= 0 && TOP_LEVEL_HEADING.test(lines[first])) lines.splice(0, first + 1)
  else lines.splice(0, Math.max(first, 0))
  return lines.join('\n').replace(LEADING_NEWLINES, '')
}

/** A new Project's Glossary from text the human brought or copied, in any format; '' when there is nothing. */
export function startingGlossary(projectName: string, text: string): string {
  const body = withoutTitle(text).trimEnd()
  return body ? `# ${projectName.trim()}\n\n${body}\n` : ''
}
