// A deliberately small markdown → HTML converter for Azure DevOps rich-text fields.
// Everything is escaped first; only paragraphs, line breaks, lists, tables, **bold**, `code` and http(s) links survive.

export const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

export function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

const isSeparatorRow = (row: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(row.trim())

function tableHtml(lines: string[]): string {
  const [head, ...rest] = lines
  const body = rest.filter((l) => !isSeparatorRow(l))
  const th = cells(head).map((c) => `<th>${inlineHtml(c)}</th>`).join('')
  const trs = body.map((l) => `<tr>${cells(l).map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}

const BULLET = /^\s*[-*]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

function blockHtml(lines: string[]): string {
  if (lines.every((l) => l.trim().startsWith('|'))) return tableHtml(lines)
  if (lines.every((l) => BULLET.test(l))) return `<ul>${lines.map((l) => `<li>${inlineHtml(l.replace(BULLET, ''))}</li>`).join('')}</ul>`
  if (lines.length > 1 && lines.every((l) => NUMBERED.test(l)))
    return `<ol>${lines.map((l) => `<li>${inlineHtml(l.replace(NUMBERED, ''))}</li>`).join('')}</ol>`
  return `<p>${lines.map(inlineHtml).join('<br>')}</p>`
}

/** Splits into blocks on blank lines, and wherever a table or list starts or ends. */
export function markdownToHtml(md: string): string {
  const blocks: string[][] = []
  let current: string[] = []
  const kind = (l: string) => (l.trim().startsWith('|') ? 'table' : BULLET.test(l) ? 'list' : 'text')
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) {
      if (current.length) blocks.push(current)
      current = []
      continue
    }
    if (current.length && kind(current[current.length - 1]) !== kind(line)) {
      blocks.push(current)
      current = []
    }
    current.push(line)
  }
  if (current.length) blocks.push(current)
  return blocks.map(blockHtml).join('\n')
}
