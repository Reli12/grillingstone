// A deliberately small markdown → HTML converter for rich-text fields (Azure DevOps, and Jira's rich paste).
// Everything is escaped first; only paragraphs, line breaks, lists, tables, **bold**, `code` and http(s) links survive.
import { type Block, markdownBlocks } from '#core/shared/markdownBlocks.ts'

// **bold text**, capturing the text (shortest match, so two bold runs on a line stay apart).
const BOLD = /\*\*(.+?)\*\*/g
// `inline code`, capturing the code.
const INLINE_CODE = /`([^`]+)`/g
// [label](http(s)://url), capturing the label and the url.
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

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

/** One table row, each cell wrapped in `tag` (th or td). */
const rowHtml = (row: string[], tag: 'th' | 'td') => row.map((cell) => `<${tag}>${inlineHtml(cell)}</${tag}>`).join('')

function listHtml(items: string[], tag: 'ul' | 'ol'): string {
  const itemsHtml = items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')
  return `<${tag}>${itemsHtml}</${tag}>`
}

function blockHtml(block: Block): string {
  switch (block.kind) {
    case 'table': {
      const bodyRows = block.rows.map((row) => `<tr>${rowHtml(row, 'td')}</tr>`).join('')
      return `<table><thead><tr>${rowHtml(block.head, 'th')}</tr></thead><tbody>${bodyRows}</tbody></table>`
    }
    case 'bullets':
      return listHtml(block.items, 'ul')
    case 'numbered':
      return listHtml(block.items, 'ol')
    case 'paragraph':
      return `<p>${block.lines.map(inlineHtml).join('<br>')}</p>`
  }
}

export const markdownToHtml = (md: string): string => markdownBlocks(md).map(blockHtml).join('\n')
