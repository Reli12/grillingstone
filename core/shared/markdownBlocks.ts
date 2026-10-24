// The small markdown subset Sections are written in, split into blocks: paragraphs, bullet and numbered
// lists, and tables. The HTML and Jira wiki emitters both render these blocks, so they agree on structure.

// The optional pipe at the start / end of a table row.
const LEADING_PIPE = /^\|/
const TRAILING_PIPE = /\|$/
// A table's header separator row, e.g. "| --- | :---: |".
const TABLE_SEPARATOR_ROW = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/
// A bullet list item marker: "- " or "* ".
const BULLET = /^\s*[-*]\s+/
// A numbered list item marker: "1. " or "1) ".
const NUMBERED = /^\s*\d+[.)]\s+/
// Windows line endings, normalised to "\n" before splitting into lines.
const CRLF = /\r\n/g

export type Block =
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'paragraph'; lines: string[] }

const cells = (row: string) =>
  row
    .trim()
    .replace(LEADING_PIPE, '')
    .replace(TRAILING_PIPE, '')
    .split('|')
    .map((cell) => cell.trim())

const isSeparatorRow = (row: string) => TABLE_SEPARATOR_ROW.test(row.trim())
const isTableRow = (line: string) => line.trim().startsWith('|')

function toBlock(lines: string[]): Block {
  if (lines.every(isTableRow)) {
    const [head, ...rest] = lines
    const rows = rest.filter((line) => !isSeparatorRow(line)).map(cells)
    return { kind: 'table', head: cells(head), rows }
  }
  if (lines.every((line) => BULLET.test(line)))
    return { kind: 'bullets', items: lines.map((line) => line.replace(BULLET, '')) }
  if (lines.length > 1 && lines.every((line) => NUMBERED.test(line)))
    return { kind: 'numbered', items: lines.map((line) => line.replace(NUMBERED, '')) }
  return { kind: 'paragraph', lines }
}

/** Which kind of block a line belongs to; a change of kind starts a new block. */
function lineKind(line: string): 'table' | 'list' | 'text' {
  if (isTableRow(line)) return 'table'
  if (BULLET.test(line)) return 'list'
  return 'text'
}

/** Splits into blocks on blank lines, and wherever a table or list starts or ends. */
export function markdownBlocks(md: string): Block[] {
  const groups: string[][] = []
  let current: string[] = []
  for (const line of md.replace(CRLF, '\n').split('\n')) {
    if (!line.trim()) {
      if (current.length) groups.push(current)
      current = []
      continue
    }
    if (current.length && lineKind(current[current.length - 1]) !== lineKind(line)) {
      groups.push(current)
      current = []
    }
    current.push(line)
  }
  if (current.length) groups.push(current)
  return groups.map(toBlock)
}
