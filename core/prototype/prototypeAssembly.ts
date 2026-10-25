// Prototype assembly (pure): turns the HTML Claude wrote into the page the tool stores. It refuses what could
// reach outside the page, inlines the session's Images, adds the Assumptions panel and the Content-Security-Policy.
// The checks are for quality; the CSP and the view sandbox are the protection (ADR-0023).
import type { ValidImage } from '#core/session/images.ts'
import type { Reason } from '#core/shared/validation.ts'

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

// An opening tag, so attributes are read only where they are markup (not in script text).
const OPENING_TAG = /<[a-zA-Z][^>]*>/g
// One attribute that can load or link something: src, href (also xlink:href), srcset, poster; the value is
// double-quoted (group 2), single-quoted (group 3) or bare (group 4).
const LOADING_ATTRIBUTE = /(?<=[\s:])(src|href|srcset|poster)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
// A CSS url(...) with an optional quote (group 1) around its value (group 2).
const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
// A CSS @import rule.
const CSS_IMPORT = /@import\b/i
// A reference to one of the session's Images, whole: `images/12`.
const IMAGE_REFERENCE = /^images\/(\d+)$/
// A run of white space, between a srcset reference and its descriptor.
const WHITESPACE = /\s+/
const BASE_TAG = /<base\b/i
const LINK_TAG = /<link\b/i
// A <meta> tag that refreshes or redirects the page.
const REFRESH_META = /<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh/i
const BODY_CLOSE = /<\/body\s*>/gi
const HEAD_OPEN = /<head\b[^>]*>/i
const HTML_OPEN = /<html\b[^>]*>/i
const DOCTYPE = /^\s*<!doctype[^>]*>/i

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

  tag(tag: string): string {
    return tag.replace(
      LOADING_ATTRIBUTE,
      (_whole, name: string, equals: string, double?: string, single?: string, bare?: string) => {
        const value = double ?? single ?? bare ?? ''
        return `${name}${equals}"${this.attribute(name, value)}"`
      },
    )
  }

  css(text: string): string {
    return text.replace(CSS_URL, (_whole, _quote: string, value: string) => `url("${this.value(value)}")`)
  }
}

const refusedReference = (value: string) =>
  reason(
    'external-reference',
    `"${value}" is not allowed: a Prototype may refer only to its Images as images/N (a number from images.md, no file extension) and to places in the page as #anchor. Nothing may load from elsewhere.`,
  )

function elementReasons(source: string): Reason[] {
  const reasons: Reason[] = []
  if (BASE_TAG.test(source)) reasons.push(reason('forbidden-element', '<base> is not allowed.'))
  if (LINK_TAG.test(source))
    reasons.push(reason('forbidden-element', '<link> is not allowed: put styles in a <style> element.'))
  if (REFRESH_META.test(source))
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

/** The policy first in <head>, so it applies before anything else in the page is read. */
function withPolicyFirst(html: string): string {
  const meta = cspMeta()
  const insertAfter = (match: RegExpExecArray, insertion: string) =>
    html.slice(0, match.index + match[0].length) + insertion + html.slice(match.index + match[0].length)
  const head = HEAD_OPEN.exec(html)
  if (head) return insertAfter(head, meta)
  const htmlOpen = HTML_OPEN.exec(html)
  if (htmlOpen) return insertAfter(htmlOpen, `<head>${meta}</head>`)
  const doctype = DOCTYPE.exec(html)
  if (doctype) return insertAfter(doctype, `<head>${meta}</head>`)
  return `<head>${meta}</head>${html}`
}

export function assemblePrototype({ source, assumptions, images }: AssemblyInput): AssemblyResult {
  const rewriter = new ReferenceRewriter(images)
  const inlined = rewriter.css(source.replace(OPENING_TAG, (tag) => rewriter.tag(tag)))
  const reasons = [
    ...elementReasons(source),
    ...[...new Set(rewriter.refused)].map(refusedReference),
    ...assumptionReasons(assumptions),
  ]
  if (reasons.length) return { ok: false, reasons }
  const withPanel = insertBeforeLastBodyClose(inlined, assumptionsPanel(assumptions))
  const usedImages = [...rewriter.used].sort((first, second) => first - second)
  return { ok: true, html: withPolicyFirst(withPanel), usedImages }
}
