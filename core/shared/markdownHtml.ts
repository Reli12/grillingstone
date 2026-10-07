// A deliberately small markdown → HTML converter for Azure DevOps rich-text fields.
// Everything is escaped first; only paragraphs, line breaks, lists, tables, **bold**, `code` and http(s) links survive.

// **bold text**, capturing the text (shortest match, so two bold runs on a line stay apart).
const BOLD = /\*\*(.+?)\*\*/g
// `inline code`, capturing the code.
const INLINE_CODE = /`([^`]+)`/g
// [label](http(s)://url), capturing the label and the url.
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
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

export const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(BOLD, '<strong>$1</strong>')
    .replace(INLINE_CODE, '<code>$1</code>')
    .replace(LINK, '<a href="$2">$1</a>')
}

const cells = (row: string) =>
  row
    .trim()
    .replace(LEADING_PIPE, '')
    .replace(TRAILING_PIPE, '')
    .split('|')
    .map((cell) => cell.trim())

const isSeparatorRow = (row: string) => TABLE_SEPARATOR_ROW.test(row.trim())
const isTableRow = (line: string) => line.trim().startsWith('|')

/** One table row, each cell wrapped in `tag` (th or td). */
const rowHtml = (row: string, tag: 'th' | 'td') =>
  cells(row)
    .map((cell) => `<${tag}>${inlineHtml(cell)}</${tag}>`)
    .join('')

function tableHtml(lines: string[]): string {
  const [head, ...rest] = lines
  const body = rest.filter((line) => !isSeparatorRow(line))
  const headerRow = rowHtml(head, 'th')
  const bodyRows = body.map((line) => `<tr>${rowHtml(line, 'td')}</tr>`).join('')
  return `<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

/** A list (ul or ol) whose items are `lines` with their `marker` removed. */
function listHtml(lines: string[], tag: 'ul' | 'ol', marker: RegExp): string {
  const items = lines.map((line) => `<li>${inlineHtml(line.replace(marker, ''))}</li>`).join('')
  return `<${tag}>${items}</${tag}>`
}

function blockHtml(lines: string[]): string {
  if (lines.every(isTableRow)) return tableHtml(lines)
  if (lines.every((line) => BULLET.test(line))) return listHtml(lines, 'ul', BULLET)
  if (lines.length > 1 && lines.every((line) => NUMBERED.test(line))) return listHtml(lines, 'ol', NUMBERED)
  return `<p>${lines.map(inlineHtml).join('<br>')}</p>`
}

/** Which kind of block a line belongs to; a change of kind starts a new block. */
function lineKind(line: string): 'table' | 'list' | 'text' {
  if (isTableRow(line)) return 'table'
  if (BULLET.test(line)) return 'list'
  return 'text'
}

/** Splits into blocks on blank lines, and wherever a table or list starts or ends. */
export function markdownToHtml(md: string): string {
  const blocks: string[][] = []
  let current: string[] = []
  for (const line of md.replace(CRLF, '\n').split('\n')) {
    if (!line.trim()) {
      if (current.length) blocks.push(current)
      current = []
      continue
    }
    if (current.length && lineKind(current[current.length - 1]) !== lineKind(line)) {
      blocks.push(current)
      current = []
    }
    current.push(line)
  }
  if (current.length) blocks.push(current)
  return blocks.map(blockHtml).join('\n')
}
