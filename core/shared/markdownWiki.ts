// A small markdown → Jira wiki markup converter, for pasting into Jira Data Center's Text mode.
// It renders the same subset as the HTML converter: paragraphs, line breaks, lists, tables, **bold**, `code`, links.
import { type Block, markdownBlocks } from '#core/shared/markdownBlocks.ts'

// **bold**, `code` or [label](http(s)://url) — the inline markdown that becomes wiki markup.
const INLINE_MARKUP = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
// Characters Jira's wiki markup reads as formatting anywhere in a line.
const WIKI_SPECIAL = /[*_{}[\]|!^~+\\]/g
// A dash or hash at the start of a line, which Jira would read as a list item.
const LEADING_LIST_MARK = /^([-#])/

export const escapeWiki = (text: string) => text.replace(WIKI_SPECIAL, '\\$&').replace(LEADING_LIST_MARK, '\\$1')

/** Text with its inline markdown turned into wiki markup; everything else escaped. */
export function inlineWiki(text: string): string {
  let wiki = ''
  let last = 0
  for (const match of text.matchAll(INLINE_MARKUP)) {
    const [whole, bold, code, label, url] = match
    wiki += escapeWiki(text.slice(last, match.index))
    // Only the alternative that matched has its groups set, and each requires at least one character.
    if (bold) wiki += `*${inlineWiki(bold)}*`
    else if (code) wiki += `{{${code}}}`
    else wiki += `[${escapeWiki(label)}|${url}]`
    last = match.index + whole.length
  }
  return wiki + escapeWiki(text.slice(last))
}

const rowWiki = (row: string[], separator: '||' | '|') =>
  `${separator}${row.map(inlineWiki).join(separator)}${separator}`

function blockWiki(block: Block): string {
  switch (block.kind) {
    case 'table':
      return [rowWiki(block.head, '||'), ...block.rows.map((row) => rowWiki(row, '|'))].join('\n')
    case 'bullets':
      return block.items.map((item) => `* ${inlineWiki(item)}`).join('\n')
    case 'numbered':
      return block.items.map((item) => `# ${inlineWiki(item)}`).join('\n')
    case 'paragraph':
      return block.lines.map(inlineWiki).join('\n')
  }
}

export const markdownToWiki = (md: string): string => markdownBlocks(md).map(blockWiki).join('\n\n')
