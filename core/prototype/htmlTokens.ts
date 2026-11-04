// A small HTML tokenizer (pure) for Prototype assembly: it cuts a page into tags, with their attributes, and the
// comment-like markup around them, the way the HTML spec does it (a quote opens a value only right after `=`; an
// unquoted value runs to white space or `>`). One pass, no backtracking: the time it takes grows with the size of the
// page, however hostile the page is. It reads markup; it does not build a document, so it knows nothing of which
// element a tag belongs to or of text that is really script.

export interface HtmlAttribute {
  /** The name as written. */
  name: string
  /** The value without its quotes; '' when there is none. */
  value: string
  hasValue: boolean
  /** Where the value is written in the source, quotes included. Empty (equal) when there is no value. */
  valueStart: number
  valueEnd: number
}

export interface HtmlTag {
  kind: 'tag'
  /** Lower case. */
  name: string
  closing: boolean
  start: number
  end: number
  attributes: HtmlAttribute[]
}

/** Markup that is not a tag: a comment, a doctype, or another `<!…>` / `<?…>` a browser reads as a comment. */
export interface HtmlOther {
  kind: 'comment' | 'doctype' | 'bogus'
  start: number
  end: number
}

export type HtmlToken = HtmlTag | HtmlOther

export interface TokenizeInput {
  source: string
  /**
   * Whether `<!--` opens a comment (and `<!…>` / `<?…>` other markup that hides what is inside). A browser does so
   * except inside script text; a check that must not be fooled either way reads the page both ways.
   */
  comments: boolean
  /**
   * Whether the content of script, style, textarea, title, xmp, iframe, noembed, noframes and noscript is skipped as
   * text (`plaintext` to the end of the page), outside <svg> and <math>, where it is markup. A stray quote in such
   * text cannot then swallow the markup after it. It is how a browser reads an HTML page; a check that must not be
   * fooled by a page that is not what it seems also reads the page without it.
   */
  rawText: boolean
}

const isSpace = (character: string | undefined) =>
  character === ' ' || character === '\t' || character === '\n' || character === '\f' || character === '\r'
const LETTER = /[a-zA-Z]/
const isLetter = (character: string | undefined) => character !== undefined && LETTER.test(character)
// The end of a comment: `-->`, or `--!>`.
const COMMENT_END = /--!?>/g

/** Reads the inside of one tag, from just after its name. */
class AttributeReader {
  pos: number
  private readonly source: string

  constructor(source: string, pos: number) {
    this.source = source
    this.pos = pos
  }

  private skipSpace() {
    while (isSpace(this.source[this.pos])) this.pos++
  }

  /** The attributes up to the closing `>`; undefined when the page ends inside the tag. */
  read(): HtmlAttribute[] | undefined {
    const attributes: HtmlAttribute[] = []
    for (;;) {
      while (isSpace(this.source[this.pos]) || this.source[this.pos] === '/') this.pos++
      if (this.pos >= this.source.length) return undefined
      if (this.source[this.pos] === '>') {
        this.pos++
        return attributes
      }
      const attribute = this.readAttribute()
      if (!attribute) return undefined
      attributes.push(attribute)
    }
  }

  private readAttribute(): HtmlAttribute | undefined {
    const nameStart = this.pos
    this.pos++ // the first character belongs to the name, even a `=`
    while (this.pos < this.source.length && !this.endsName(this.source[this.pos])) this.pos++
    const name = this.source.slice(nameStart, this.pos)
    const afterName = this.pos
    this.skipSpace()
    if (this.source[this.pos] !== '=') {
      this.pos = afterName
      return { name, value: '', hasValue: false, valueStart: afterName, valueEnd: afterName }
    }
    this.pos++
    this.skipSpace()
    return this.readValue(name)
  }

  private endsName(character: string) {
    return isSpace(character) || character === '/' || character === '>' || character === '='
  }

  private readValue(name: string): HtmlAttribute | undefined {
    const valueStart = this.pos
    const quote = this.source[valueStart]
    if (quote === '"' || quote === "'") {
      const close = this.source.indexOf(quote, valueStart + 1)
      if (close < 0) return undefined
      this.pos = close + 1
      const value = this.source.slice(valueStart + 1, close)
      return { name, value, hasValue: true, valueStart, valueEnd: this.pos }
    }
    while (this.pos < this.source.length && !this.endsBareValue(this.source[this.pos])) this.pos++
    const value = this.source.slice(valueStart, this.pos)
    return { name, value, hasValue: true, valueStart, valueEnd: this.pos }
  }

  private endsBareValue(character: string) {
    return isSpace(character) || character === '>'
  }
}

/** What was read at a `<`: the token (none for markup that is dropped) and where reading goes on. */
interface Read {
  token?: HtmlToken
  end: number
}

function readTag(source: string, open: number): Read {
  const closing = source[open + 1] === '/'
  const nameStart = open + (closing ? 2 : 1)
  let pos = nameStart
  while (pos < source.length && !isSpace(source[pos]) && source[pos] !== '/' && source[pos] !== '>') pos++
  const reader = new AttributeReader(source, pos)
  const attributes = reader.read()
  // A page that ends inside a tag drops the tag, and has nothing after it.
  if (!attributes) return { end: source.length }
  const name = source.slice(nameStart, pos).toLowerCase()
  return { token: { kind: 'tag', name, closing, start: open, end: reader.pos, attributes }, end: reader.pos }
}

const commentRead = (start: number, end: number): Read => ({ token: { kind: 'comment', start, end }, end })

function readComment(source: string, open: number): Read {
  // `<!-->` and `<!--->` are empty comments.
  if (source.startsWith('>', open + 4)) return commentRead(open, open + 5)
  if (source.startsWith('->', open + 4)) return commentRead(open, open + 6)
  COMMENT_END.lastIndex = open + 4
  const found = COMMENT_END.exec(source)
  return commentRead(open, found ? found.index + found[0].length : source.length)
}

function readBogus(source: string, open: number): Read {
  const close = source.indexOf('>', open)
  const end = close < 0 ? source.length : close + 1
  const kind = source.slice(open, open + 9).toLowerCase() === '<!doctype' ? 'doctype' : 'bogus'
  return { token: { kind, start: open, end }, end }
}

function readAt(source: string, open: number, comments: boolean): Read {
  const next = source[open + 1]
  if (comments && source.startsWith('<!--', open)) return readComment(source, open)
  if (comments && (next === '!' || next === '?')) return readBogus(source, open)
  if (isLetter(next)) return readTag(source, open)
  if (next === '/' && isLetter(source[open + 2])) return readTag(source, open)
  if (next === '/' && source[open + 2] === '>') return { end: open + 3 }
  if (next === '/' && comments) return readBogus(source, open)
  return { end: open + 1 }
}

// Elements whose content a browser reads as text, to the end tag: script text, style text, and text with character
// references (title, textarea); the rest are text in a page that runs scripts. The end tag is `</name` followed by
// white space, `/` or `>`, whatever the case.
const RAW_TEXT_ENDS = new Map(
  ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'].map((name) => [
    name,
    new RegExp(`</${name}(?=[\\s/>])`, 'gi'),
  ]),
)

/** Where the text of a raw-text element that just started, at `from`, ends; undefined when it is another element. */
function rawTextEnd(source: string, tag: HtmlTag, from: number): number | undefined {
  if (tag.closing) return undefined
  if (tag.name === 'plaintext') return source.length
  const endTag = RAW_TEXT_ENDS.get(tag.name)
  if (!endTag) return undefined
  endTag.lastIndex = from
  return endTag.exec(source)?.index ?? source.length
}

/** How one tag changes the depth of <svg> / <math>, whose content is markup even in <title>, <style> and <script>. */
function foreignChange(tag: HtmlTag): number {
  if (tag.name !== 'svg' && tag.name !== 'math') return 0
  return tag.closing ? -1 : 1
}

/** The tags and comment-like markup of the page, in order. */
export function tokenizeHtml({ source, comments, rawText }: TokenizeInput): HtmlToken[] {
  const tokens: HtmlToken[] = []
  let pos = 0
  let foreign = 0
  for (;;) {
    const open = source.indexOf('<', pos)
    if (open < 0) return tokens
    const read = readAt(source, open, comments)
    pos = read.end
    if (!read.token) continue
    tokens.push(read.token)
    if (read.token.kind !== 'tag') continue
    foreign = Math.max(0, foreign + foreignChange(read.token))
    if (rawText && foreign === 0) pos = rawTextEnd(source, read.token, pos) ?? pos
  }
}
