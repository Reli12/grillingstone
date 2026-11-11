// Azure DevOps rich text back to the markdown subset Sections are written in: the inverse of markdownHtml.ts.
// Used where something written in Azure DevOps comes back into the tool (Refresh, Import, Drift). Only structure
// survives — headings, paragraphs and line breaks, lists, tables, bold, code and http(s) links; everything else
// (colours, fonts, images, scripts) is dropped as plain text or not at all.

type HtmlNode = { type: 'text'; text: string } | { type: 'element'; tag: string; href?: string; children: HtmlNode[] }

/** A block of a rich-text field, as markdown text: what a Section body or an Entry is built from. */
export type HtmlBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

// A comment, a start or end tag (capturing "/", the name and the attributes), or a run of text.
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)([^>]*)>|[^<]+|</g
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi
const WHITESPACE_RUN = /[ \t\r\n\f\u00a0]+/g
const SAFE_LINK = /^https?:\/\//i

const VOID_TAGS = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'col', 'wbr'])
/** Their content is never text a human wrote into the field. */
const DROPPED_TAGS = new Set(['script', 'style', 'head', 'title'])
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole, name: string) => {
    const lower = name.toLowerCase()
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16))
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10))
    return NAMED_ENTITIES[lower] ?? whole
  })
}

/** A forgiving parse: unclosed tags close with their parent, stray end tags are ignored. */
function parseHtml(html: string): HtmlNode[] {
  const root: HtmlNode = { type: 'element', tag: '#root', children: [] }
  const stack: Extract<HtmlNode, { type: 'element' }>[] = [root]
  const top = () => stack[stack.length - 1]
  for (const match of html.matchAll(TOKEN)) {
    const [token, slash, rawTag, attrs] = match
    if (token.startsWith('<!--')) continue
    if (!rawTag) {
      top().children.push({ type: 'text', text: decodeEntities(token) })
      continue
    }
    const tag = rawTag.toLowerCase()
    if (slash) {
      const at = stack.map((node) => node.tag).lastIndexOf(tag)
      if (at > 0) stack.length = at
      continue
    }
    const hrefMatch = HREF.exec(attrs)
    const href = hrefMatch ? decodeEntities(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '') : undefined
    const node = { type: 'element' as const, tag, ...(href ? { href } : {}), children: [] as HtmlNode[] }
    top().children.push(node)
    if (!VOID_TAGS.has(tag) && !attrs.trimEnd().endsWith('/')) stack.push(node)
  }
  return root.type === 'element' ? root.children : []
}

/** Inline content as markdown; "\n" marks a <br>. */
function inline(nodes: HtmlNode[]): string {
  return nodes.map(inlineNode).join('')
}

function inlineNode(node: HtmlNode): string {
  if (node.type === 'text') return node.text.replace(WHITESPACE_RUN, ' ')
  if (DROPPED_TAGS.has(node.tag)) return ''
  const content = inline(node.children)
  switch (node.tag) {
    case 'br':
      return '\n'
    case 'strong':
    case 'b':
      return content.trim() ? `**${content.trim()}**` : content
    case 'code':
      return content.trim() ? `\`${content.trim()}\`` : content
    case 'a':
      return node.href && SAFE_LINK.test(node.href) && content.trim() ? `[${content.trim()}](${node.href})` : content
    default:
      return content
  }
}

/** Lines of inline text: trimmed, blank ones dropped. */
const linesOf = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const LIST_TAGS = new Set(['ul', 'ol'])
/** Tags that start a new block; anything else is inline. */
const BLOCK_TAGS = new Set([
  ...HEADINGS,
  ...LIST_TAGS,
  'p',
  'div',
  'table',
  'blockquote',
  'pre',
  'section',
  'article',
  'li',
  'tr',
  'hr',
])

const isBlock = (node: HtmlNode) => node.type === 'element' && BLOCK_TAGS.has(node.tag)

const elementChildren = (node: HtmlNode, tag: string): Extract<HtmlNode, { type: 'element' }>[] =>
  node.type === 'element'
    ? node.children.flatMap((child) => {
        if (child.type !== 'element') return []
        if (child.tag === tag) return [child]
        // thead / tbody / tfoot are only wrappers around rows.
        return ['thead', 'tbody', 'tfoot'].includes(child.tag) ? elementChildren(child, tag) : []
      })
    : []

function tableBlock(node: HtmlNode): HtmlBlock | null {
  const rows = elementChildren(node, 'tr').map((row) =>
    row.children
      .filter((cell): cell is Extract<HtmlNode, { type: 'element' }> => cell.type === 'element')
      .filter((cell) => cell.tag === 'td' || cell.tag === 'th')
      .map((cell) => inline(cell.children).replaceAll('\n', ' ').trim()),
  )
  if (!rows.length) return null
  const [head, ...body] = rows
  return { kind: 'table', head, rows: body }
}

function listBlock(node: Extract<HtmlNode, { type: 'element' }>): HtmlBlock | null {
  const items = node.children
    .filter((child): child is Extract<HtmlNode, { type: 'element' }> => child.type === 'element' && child.tag === 'li')
    .map((item) => linesOf(inline(item.children)).join(' '))
    .filter(Boolean)
  if (!items.length) return null
  return node.tag === 'ol' ? { kind: 'numbered', items } : { kind: 'bullets', items }
}

/** Walks the tree, gathering inline runs into paragraphs and turning block elements into blocks. */
function collectBlocks(nodes: HtmlNode[], blocks: HtmlBlock[]) {
  let run: HtmlNode[] = []
  const flush = () => {
    const lines = linesOf(inline(run))
    if (lines.length) blocks.push({ kind: 'paragraph', lines })
    run = []
  }
  for (const node of nodes) {
    if (node.type === 'element' && DROPPED_TAGS.has(node.tag)) continue
    if (!isBlock(node)) {
      run.push(node)
      continue
    }
    flush()
    const element = node as Extract<HtmlNode, { type: 'element' }>
    if (HEADINGS.has(element.tag)) {
      const text = linesOf(inline(element.children)).join(' ')
      if (text) blocks.push({ kind: 'heading', text })
    } else if (LIST_TAGS.has(element.tag)) {
      const list = listBlock(element)
      if (list) blocks.push(list)
    } else if (element.tag === 'table') {
      const table = tableBlock(element)
      if (table) blocks.push(table)
    } else if (element.tag !== 'hr') {
      // A <p> or <div> holding only inline content is one paragraph; one holding blocks is walked into.
      if (element.children.some(isBlock)) collectBlocks(element.children, blocks)
      else {
        const lines = linesOf(inline(element.children))
        if (lines.length) blocks.push({ kind: 'paragraph', lines })
      }
    }
  }
  flush()
}

export function htmlBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  collectBlocks(parseHtml(html), blocks)
  return blocks
}

const tableRow = (cells: string[]) => `| ${cells.join(' | ')} |`

export function blockMarkdown(block: HtmlBlock): string {
  switch (block.kind) {
    case 'heading':
      return `## ${block.text}`
    case 'paragraph':
      return block.lines.join('\n')
    case 'bullets':
      return block.items.map((item) => `- ${item}`).join('\n')
    case 'numbered':
      return block.items.map((item, index) => `${index + 1}. ${item}`).join('\n')
    case 'table':
      return [tableRow(block.head), tableRow(block.head.map(() => '---')), ...block.rows.map(tableRow)].join('\n')
  }
}

export const blocksMarkdown = (blocks: HtmlBlock[]) => blocks.map(blockMarkdown).join('\n\n')

/** A rich-text field as markdown; '' for an empty or missing field. */
export const htmlToMarkdown = (html: string | undefined | null): string =>
  html ? blocksMarkdown(htmlBlocks(html)) : ''
