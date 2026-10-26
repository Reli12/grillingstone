// Reading the reference in a CSS url(...) in one forward pass, for Prototype assembly (pure). No backtracking: the
// time it takes grows with the size of the CSS, however hostile it is.

/**
 * The next place a character occurs, for scans that only move forward: the answer is kept while it still holds, so
 * many scans that each look for the same far-off character cost one pass over the text between them, not one each.
 */
export class NextFinder {
  private readonly text: string
  private readonly known = new Map<string, { from: number; at: number }>()

  constructor(text: string) {
    this.text = text
  }

  next(character: string, from: number): number {
    const last = this.known.get(character)
    if (last && from >= last.from && (last.at < 0 || last.at >= from)) return last.at
    const at = this.text.indexOf(character, from)
    this.known.set(character, { from, at })
    return at
  }
}

export interface CssUrl {
  value: string
  /** Just after the closing `)`. */
  end: number
}

const isCssSpace = (character: string | undefined) =>
  character === ' ' || character === '\t' || character === '\n' || character === '\f' || character === '\r'

/** The reference in a url( that opened just before `from`: `"quoted"`, `'quoted'` or bare, up to the `)`. */
export function readCssUrl(text: string, from: number, finder: NextFinder): CssUrl | undefined {
  let start = from
  while (isCssSpace(text[start])) start++
  const quote = text[start]
  if (quote === '"' || quote === "'") {
    const close = finder.next(quote, start + 1)
    let after = close + 1
    while (close >= 0 && isCssSpace(text[after])) after++
    if (close >= 0 && text[after] === ')') return { value: text.slice(start + 1, close), end: after + 1 }
  }
  const end = finder.next(')', start)
  if (end < 0) return undefined
  return { value: text.slice(start, end).trimEnd(), end: end + 1 }
}
