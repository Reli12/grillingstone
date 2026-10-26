// Prototype assembly (pure): turns the HTML Claude wrote into the page the tool stores. It refuses what could
// reach outside the page, inlines the session's Images, adds the Assumptions panel and the Content-Security-Policy.
// The checks are for quality; the CSP and the view sandbox are the protection (ADR-0023).
import type { ValidImage } from '#core/session/images.ts'
import type { Reason } from '#core/shared/validation.ts'

import { NextFinder, readCssUrl } from './cssUrls.ts'
import { type HtmlAttribute, type HtmlTag, type HtmlToken, tokenizeHtml } from './htmlTokens.ts'

export interface PrototypeAssumption {
  /** What was chosen. */
  choice: string
  /** Why it was a guess: what the Draft and the Images leave open. */
  why: string
}

/** One Image of the session, by the number Claude refers to it with (`images/N`). */
export type AssemblyImage = ValidImage & { number: number }

export interface AssemblyInput {
  /** Claude's HTML as submitted. */
  source: string
  assumptions: PrototypeAssumption[]
  images: AssemblyImage[]
}

export interface AssembledPage {
  ok: true
  html: string
  /** Numbers of the Images the page shows, once each, ascending. */
  usedImages: number[]
}

export type AssemblyResult = AssembledPage | { ok: false; reasons: Reason[] }

/** What a stored Prototype may load: nothing but its own inline code, styles and data: images. */
export const PROTOTYPE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'"
/** The same policy for the view route's header, which also sandboxes the page into an opaque origin. */
export const PROTOTYPE_VIEW_CSP = `sandbox allow-scripts allow-forms allow-modals; ${PROTOTYPE_CSP}`

// Attributes that can load or link something: src, href (also xlink:href), srcset, poster.
const LOADING_ATTRIBUTES = new Set(['src', 'href', 'srcset', 'poster'])
// Where a CSS url(...) opens.
const URL_OPEN = /url\(/gi
const URL_OPEN_LENGTH = 'url('.length
// A CSS @import rule.
const CSS_IMPORT = /@import\b/i
// A reference to one of the session's Images, whole: `images/12`.
const IMAGE_REFERENCE = /^images\/(\d+)$/
// A run of white space, between a srcset reference and its descriptor.
const WHITESPACE = /\s+/
const BASE_TAG = /<base\b/i
const LINK_TAG = /<link\b/i
// A numeric character reference, which a browser decodes in an attribute value even without the `;`.
const NUMERIC_REFERENCE = /&#(?:x([0-9a-f]+)|(\d+));?/gi
const LAST_CODE_POINT = 0x10ffff
const BODY_CLOSE = /<\/body\s*>/gi
// Anything but HTML white space: text between markup.
const NOT_SPACE = /[^ \t\n\f\r]/

const PANEL_ID = 'grillingstone-assumptions'

const reason = (code: string, message: string): Reason => ({ code, message })

type Classified = { kind: 'anchor' } | { kind: 'image'; image: AssemblyImage } | { kind: 'refused' }

function classify(value: string, images: AssemblyImage[]): Classified {
  const trimmed = value.trim()
  if (trimmed.startsWith('#')) return { kind: 'anchor' }
  const match = IMAGE_REFERENCE.exec(trimmed)
  const image = match ? images.find((candidate) => candidate.number === Number(match[1])) : undefined
  return image ? { kind: 'image', image } : { kind: 'refused' }
}

const dataUri = (image: AssemblyImage) => `data:${image.mediaType};base64,${image.data}`

function isLoadingAttribute(name: string): boolean {
  const local = name.slice(name.lastIndexOf(':') + 1)
  return LOADING_ATTRIBUTES.has(local.toLowerCase())
}

/** Rewrites every reference in the page, noting the Images it shows and the references it cannot allow. */
class ReferenceRewriter {
  readonly used = new Set<number>()
  readonly refused: string[] = []

  private readonly images: AssemblyImage[]

  constructor(images: AssemblyImage[]) {
    this.images = images
  }

  /** The value with its Image reference inlined; an anchor stays; anything else is noted and left as it is. */
  value(value: string): string {
    const found = classify(value, this.images)
    if (found.kind === 'anchor') return value
    if (found.kind === 'refused') {
      this.refused.push(value.trim())
      return value
    }
    this.used.add(found.image.number)
    return dataUri(found.image)
  }

  /** A srcset: comma-separated candidates, each a reference and an optional descriptor. */
  srcset(value: string): string {
    return value
      .split(',')
      .map((candidate) => {
        const [reference = '', ...descriptor] = candidate.trim().split(WHITESPACE)
        return [this.value(reference), ...descriptor].join(' ')
      })
      .join(', ')
  }

  attribute(name: string, value: string): string {
    return name.toLowerCase() === 'srcset' ? this.srcset(value) : this.value(value)
  }

  /**
   * The page with every loading attribute of its tags rewritten. A value that changed is written again in double
   * quotes with any `"` in it escaped, so it cannot end early; one that did not change stays as it was written.
   */
  html(source: string, tokens: HtmlToken[]): string {
    const parts: string[] = []
    let copied = 0
    for (const token of tokens) {
      if (token.kind !== 'tag') continue
      for (const attribute of token.attributes) {
        if (!attribute.hasValue || !isLoadingAttribute(attribute.name)) continue
        const rewritten = this.attribute(attribute.name, attribute.value)
        if (rewritten === attribute.value) continue
        parts.push(source.slice(copied, attribute.valueStart), `"${rewritten.replaceAll('"', '&quot;')}"`)
        copied = attribute.valueEnd
      }
    }
    parts.push(source.slice(copied))
    return parts.join('')
  }

  /** The CSS with every url(...) rewritten the same way; a reference that did not change stays as written. */
  css(text: string): string {
    const parts: string[] = []
    const finder = new NextFinder(text)
    let copied = 0
    let from = 0
    for (;;) {
      URL_OPEN.lastIndex = from
      const open = URL_OPEN.exec(text)
      if (!open) break
      const reference = readCssUrl(text, open.index + URL_OPEN_LENGTH, finder)
      from = reference ? reference.end : open.index + URL_OPEN_LENGTH
      if (!reference) continue
      const rewritten = this.value(reference.value)
      if (rewritten === reference.value) continue
      parts.push(text.slice(copied, open.index), `url("${rewritten}")`)
      copied = reference.end
    }
    parts.push(text.slice(copied))
    return parts.join('')
  }
}

const refusedReference = (value: string) =>
  reason(
    'external-reference',
    `"${value}" is not allowed: a Prototype may refer only to its Images as images/N (a number from images.md, no file extension) and to places in the page as #anchor. Nothing may load from elsewhere.`,
  )

function decodeNumericReferences(text: string): string {
  return text.replace(NUMERIC_REFERENCE, (whole, hex?: string, decimal?: string) => {
    const code = hex === undefined ? Number(decimal) : Number.parseInt(hex, 16)
    return code <= LAST_CODE_POINT ? String.fromCodePoint(code) : whole
  })
}

/** Whether the attribute says `http-equiv="refresh"`, however its value is spelled with character references. */
function isRefresh(attribute: HtmlAttribute): boolean {
  if (attribute.name.toLowerCase() !== 'http-equiv') return false
  return decodeNumericReferences(attribute.value).toLowerCase().includes('refresh')
}

/** Whether any <meta> tag refreshes or redirects the page. */
function refreshesPage(tokens: HtmlToken[]): boolean {
  return tokens.some((token) => token.kind === 'tag' && token.name === 'meta' && token.attributes.some(isRefresh))
}

function elementReasons(source: string, tokenings: HtmlToken[][]): Reason[] {
  const reasons: Reason[] = []
  if (BASE_TAG.test(source)) reasons.push(reason('forbidden-element', '<base> is not allowed.'))
  if (LINK_TAG.test(source))
    reasons.push(reason('forbidden-element', '<link> is not allowed: put styles in a <style> element.'))
  if (tokenings.some(refreshesPage))
    reasons.push(reason('forbidden-element', '<meta http-equiv="refresh"> is not allowed.'))
  if (CSS_IMPORT.test(source))
    reasons.push(reason('external-reference', '@import is not allowed: put all CSS in the page.'))
  return reasons
}

function assumptionReasons(assumptions: PrototypeAssumption[]): Reason[] {
  if (!assumptions.length)
    return [reason('no-assumptions', 'List at least one assumption: every Prototype guesses something.')]
  const blank = assumptions.findIndex((assumption) => !assumption.choice.trim())
  return blank < 0
    ? []
    : [reason('empty-assumption-choice', `Assumption ${blank + 1} has no "choice": say what was chosen.`)]
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
// The five characters that must not appear raw in text or in a quoted attribute.
const HTML_SPECIAL = /[&<>"']/g
const escapeHtml = (text: string) => text.replace(HTML_SPECIAL, (character) => HTML_ESCAPES[character])

// `!important` on the properties a page's own stylesheet could use to hide or move the panel.
const PANEL_STYLE =
  'position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;max-width:min(420px,calc(100vw - 24px))!important;font:14px/1.4 system-ui,sans-serif!important;color:#1a1a1a!important;background:#fffbe6!important;border:1px solid #d6b656!important;border-radius:8px!important;box-shadow:0 2px 8px rgba(0,0,0,.25)!important;padding:0!important;margin:0!important'
const SUMMARY_STYLE =
  'cursor:pointer!important;padding:8px 12px!important;font-weight:600!important;list-style:none!important'
const LIST_STYLE =
  'margin:0!important;padding:4px 12px 12px 30px!important;max-height:50vh!important;overflow:auto!important'
const ITEM_STYLE = 'margin:0 0 8px!important;padding:0!important'
const WHY_STYLE = 'display:block!important;color:#555!important'

/** The tool's own panel: a corner button that expands into every choice and why it was a guess. */
function assumptionsPanel(assumptions: PrototypeAssumption[]): string {
  const items = assumptions
    .map(
      (assumption) =>
        `<li style="${ITEM_STYLE}">${escapeHtml(assumption.choice.trim())}<span style="${WHY_STYLE}">${escapeHtml(assumption.why.trim())}</span></li>`,
    )
    .join('')
  return `<details id="${PANEL_ID}" style="${PANEL_STYLE}"><summary style="${SUMMARY_STYLE}">Assumptions (${assumptions.length})</summary><ol style="${LIST_STYLE}">${items}</ol></details>`
}

function insertBeforeLastBodyClose(html: string, insertion: string): string {
  const closes = [...html.matchAll(BODY_CLOSE)]
  const last = closes.at(-1)
  if (!last) return html + insertion
  return html.slice(0, last.index) + insertion + html.slice(last.index)
}

const cspMeta = () => `<meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`

interface Opening {
  /** Where the doctype ends; 0 when the page opens with none. */
  doctypeEnd: number
  /** The first start tags, with nothing but white space, comments and the doctype before them (at most two). */
  tags: HtmlTag[]
}

/** What the page opens with, up to its first text or its second tag. */
function openingOf(html: string, tokens: HtmlToken[]): Opening {
  const opening: Opening = { doctypeEnd: 0, tags: [] }
  let pos = 0
  for (const token of tokens) {
    if (NOT_SPACE.test(html.slice(pos, token.start))) break
    pos = token.end
    if (token.kind === 'doctype' && !opening.tags.length) opening.doctypeEnd = token.end
    if (token.kind !== 'tag') continue
    opening.tags.push(token)
    if (opening.tags.length === 2) break
  }
  return opening
}

// `tag` may be missing at run time (a page with fewer than two tags), which the array types do not say.
const isStartTag = (tag: HtmlTag | undefined, name: string): boolean =>
  tag !== undefined && !tag.closing && tag.name === name

/**
 * The policy first in the real <head>, so it applies before anything else in the page is read. Only a <head> that
 * the browser would open counts: one in a comment, in script text or after other content does not. Where the page's
 * own head cannot be told to come first, a head holding the policy is put ahead of everything (after the doctype),
 * and the browser takes it as the page's head.
 */
function withPolicyFirst(html: string): string {
  const meta = cspMeta()
  const insertAt = (index: number, insertion: string) => html.slice(0, index) + insertion + html.slice(index)
  const ownHead = `<head>${meta}</head>`
  const { doctypeEnd, tags } = openingOf(html, tokenizeHtml({ source: html, comments: true, rawText: true }))
  const [first, second] = tags
  if (isStartTag(first, 'head')) return insertAt(first.end, meta)
  if (!isStartTag(first, 'html')) return insertAt(doctypeEnd, ownHead)
  return isStartTag(second, 'head') ? insertAt(second.end, meta) : insertAt(first.end, ownHead)
}

// The first reading is the one the page is rewritten from.
const READINGS: { comments: boolean; rawText: boolean }[] = [
  { comments: true, rawText: false },
  { comments: false, rawText: false },
  { comments: true, rawText: true },
  { comments: false, rawText: true },
]

export function assemblePrototype({ source, assumptions, images }: AssemblyInput): AssemblyResult {
  // The page is read four ways, with and without comments and with and without the text of script, style and the
  // like skipped: a browser does neither inside <svg>, and does both elsewhere, so what hides on one reading is plain
  // markup on another. A reference or a refresh found on any reading refuses the page. That includes a tag written
  // as a string in a script, which is text for a browser but cannot be told from markup inside <svg>. The page itself
  // is rewritten from the first reading.
  const readings = READINGS.map((reading) => tokenizeHtml({ source, ...reading }))
  const rewriter = new ReferenceRewriter(images)
  const inlined = rewriter.css(rewriter.html(source, readings[0]))
  const otherRefused = readings.slice(1).flatMap((tokens) => {
    const checker = new ReferenceRewriter(images)
    checker.html(source, tokens)
    return checker.refused
  })
  const reasons = [
    ...elementReasons(source, readings),
    ...[...new Set([...rewriter.refused, ...otherRefused])].map(refusedReference),
    ...assumptionReasons(assumptions),
  ]
  if (reasons.length) return { ok: false, reasons }
  const withPanel = insertBeforeLastBodyClose(inlined, assumptionsPanel(assumptions))
  const usedImages = [...rewriter.used].sort((first, second) => first - second)
  return { ok: true, html: withPolicyFirst(withPanel), usedImages }
}
