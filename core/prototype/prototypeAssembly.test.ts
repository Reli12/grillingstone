// Tests for Prototype assembly: what it refuses in Claude's HTML, and what it adds to the stored page.
import { describe, expect, it } from 'vitest'

import { assemblePrototype, PROTOTYPE_CSP, PROTOTYPE_VIEW_CSP } from '#core/prototype/prototypeAssembly.ts'

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const images = [
  { number: 1, mediaType: 'image/png' as const, data: PIXEL },
  { number: 2, mediaType: 'image/jpeg' as const, data: 'AAAA' },
]
const assumptions = [{ choice: 'Sample devices are invented', why: 'The Draft names no example data.' }]

const page = (body: string, head = '<title>Devices</title>') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

const assemble = (source: string, overrides: { assumptions?: typeof assumptions } = {}) =>
  assemblePrototype({ source, assumptions: overrides.assumptions ?? assumptions, images })

/** The stored HTML of a Prototype that must be accepted. */
function accepted(source: string) {
  const result = assemble(source)
  if (!result.ok) {
    const messages = result.reasons.map((reason) => reason.message)
    throw new Error(`Expected acceptance, got: ${messages.join(' | ')}`)
  }
  return result
}

const refusedCodes = (source: string, overrides: { assumptions?: typeof assumptions } = {}) => {
  const result = assemble(source, overrides)
  return result.ok ? [] : result.reasons.map((reason) => reason.code)
}

describe('Prototype assembly: refusals', () => {
  it.each([
    ['an external src', '<img src="https://cdn.example.com/a.png">'],
    ['a protocol-relative src', '<script src="//cdn.example.com/a.js"></script>'],
    ['a relative file src', '<img src="logo.png">'],
    ['a data URI src', '<img src="data:image/png;base64,AAAA">'],
    ['an external href', '<a href="https://example.com">out</a>'],
    ['a javascript: href', '<a href="javascript:alert(1)">x</a>'],
    ['an xlink:href', '<svg><use xlink:href="https://example.com/s.svg#a"></use></svg>'],
    ['an external srcset candidate', '<img srcset="images/1 1x, https://example.com/b.png 2x">'],
    ['an external poster', '<video poster="https://example.com/p.jpg"></video>'],
    ['an unquoted external src', '<img src=https://example.com/a.png>'],
    ['an empty src', '<img src="">'],
  ])('refuses %s', (_name, body) => {
    expect(refusedCodes(page(body))).toContain('external-reference')
  })

  it.each([
    ['a CSS url() to the internet', '<style>body { background: url(https://example.com/bg.png) }</style>'],
    ['a quoted CSS url()', `<div style="background: url('https://example.com/bg.png')"></div>`],
    ['a CSS @import', '<style>@import "https://fonts.example.com/a.css"; body{}</style>'],
    ['an @import url()', '<style>@import url(https://fonts.example.com/a.css);</style>'],
  ])('refuses %s', (_name, body) => {
    expect(refusedCodes(page(body))).toContain('external-reference')
  })

  it.each([
    ['a ">" inside an earlier quoted attribute', '<img alt="a>b" src="https://evil/x.png">'],
    ['a single-quoted ">" inside an earlier attribute', `<img alt='a>b' src='https://evil/x.png'>`],
    ['no white space between attributes', '<img alt="x"src="https://evil">'],
    ['no white space before an href', '<a title="x"href="https://evil">x</a>'],
    ['a "/" instead of white space', '<img/src="https://evil/x.png">'],
    ['a stray quote in an unquoted value before a quoted ">"', '<img alt=a"b title="x>y" src=http://evil.test/p.png>'],
    ['a stray single quote in an unquoted value', `<img alt=a'b title='x>y' src=http://evil.test/p.png>`],
  ])('refuses a reference with %s', (_name, body) => {
    expect(refusedCodes(page(body))).toContain('external-reference')
  })

  // Text a browser does not read as markup (script, style, textarea, …) can hold a stray quote that, read as markup,
  // swallows what comes after it.
  const SCRIPT_AND_STYLE = ['script', 'SCRIPT', 'style', 'STYLE', 'textarea', 'title']
  const OTHER_TEXT_ELEMENTS = ['xmp', 'iframe', 'noembed', 'noframes', 'noscript']
  it.each([...SCRIPT_AND_STYLE, ...OTHER_TEXT_ELEMENTS])('refuses a reference after a stray quote in <%s>', (name) => {
    const body = `<${name}><b a='</${name}><img src=http://evil.test/x.png alt='x'>`
    expect(refusedCodes(page(body))).toContain('external-reference')
  })

  it('refuses a meta refresh after a stray quote inside script text', () => {
    const body = `<script>var s="<b a='";</script><meta http-equiv="refresh" content="0;url=http://evil.test/" x='y'>`
    expect(refusedCodes(page(body))).toContain('forbidden-element')
  })

  it('refuses a CSS url() and @import in <style> text, whatever case the tag is in', () => {
    const url = `<STYLE>a{content:"<b a='"}b{background:url(http://evil.test/x.png)}</STYLE>`
    expect(refusedCodes(page(url))).toContain('external-reference')
    const imported = `<style>a{content:"<b a='"}@import "http://evil.test/a.css";</style>`
    expect(refusedCodes(page(imported))).toContain('external-reference')
  })

  it('refuses a tag written as a string in script text, which it cannot tell from markup in <svg>', () => {
    const body = `<script>el.innerHTML = '<img src=http://evil.test/x.png>'</script>`
    expect(refusedCodes(page(body))).toContain('external-reference')
  })

  it('accepts script text with a stray quote in a string literal when nothing else is wrong', () => {
    expect(assemble(page(`<script>var s="<b a='";</script><p>ok</p>`)).ok).toBe(true)
  })

  it('still accepts anchors and Image references written that way', () => {
    expect(assemble(page('<a alt="a>b" href="#top">x</a><img alt="x"src="images/1">')).ok).toBe(true)
  })

  it('keeps a quote inside a single-quoted anchor within that one attribute', () => {
    const { html } = accepted(page(`<a href='#x" y'>x</a>`))
    expect(html).toContain(`<a href='#x" y'>`)
  })

  it.each([
    ['a decimal reference', '<meta http-equiv="&#114;efresh" content="0;url=#x">'],
    ['a hex reference', '<meta http-equiv="&#x72;efresh" content="0;url=#x">'],
    ['a decimal reference without a semicolon', '<meta http-equiv="&#114efresh" content="0;url=#x">'],
    ['upper case and a single quote', `<meta HTTP-EQUIV='REFRESH' content="0">`],
    ['a ">" in an earlier attribute', '<meta content="a>b" http-equiv="refresh">'],
    [
      'a stray quote in an unquoted value before a quoted ">"',
      '<meta alt=a"b title="x>y" http-equiv="refresh" content="0;url=http://evil.test/">',
    ],
  ])('refuses a refreshing <meta> written with %s', (_name, head) => {
    expect(refusedCodes(page('<p>x</p>', head))).toContain('forbidden-element')
  })

  it.each([
    ['a self-closing <svg/>', '<svg/><title><a b="</title><meta http-equiv=refresh content="0;url=//evil.test">'],
    ['a self-closing <math/>', '<math/><title><a b="</title><meta http-equiv=refresh content="0;url=//evil.test">'],
    [
      'an HTML breakout from <svg>',
      '<svg><p><title><a b="</title><meta http-equiv=refresh content="0;url=//evil.test">',
    ],
    [
      'a <foreignObject> integration point',
      '<svg><foreignObject><title><a b="</title></foreignObject></svg><meta http-equiv=refresh content="0;url=//evil.test">',
    ],
    [
      'the script double-escape state',
      '<script><!--<script></script><a b="</script><meta http-equiv=refresh content="0;url=//evil.test">',
    ],
  ])('refuses a meta refresh hidden behind %s', (_name, body) => {
    expect(refusedCodes(page(body))).toContain('forbidden-element')
  })

  it.each([
    ['a Content-Security-Policy of its own', `<meta http-equiv="Content-Security-Policy" content="default-src *">`],
    ['a value spelled with references', '<meta http-equiv="&#114;efresh" content="0">'],
  ])('refuses any http-equiv, here %s, since the tool adds the only one', (_name, head) => {
    expect(refusedCodes(page('<p>x</p>', head))).toContain('forbidden-element')
  })

  it('refuses an Image number the session does not have, with the number in the reason', () => {
    const result = assemble(page('<img src="images/9">'))
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.reasons[0]).toMatchObject({ code: 'external-reference' })
    expect(result.reasons[0].message).toContain('images/9')
  })

  it('refuses an Image reference carrying a file extension', () => {
    expect(refusedCodes(page('<img src="images/1.png">'))).toContain('external-reference')
  })

  it.each([
    ['<base>', '<base href="#">'],
    ['<link>', '<link rel="stylesheet" href="#">'],
    ['a refreshing <meta>', '<meta http-equiv="refresh" content="0;url=#x">'],
  ])('refuses %s', (_name, head) => {
    expect(refusedCodes(page('<p>x</p>', head))).toContain('forbidden-element')
  })

  it('leaves an ordinary <meta> alone', () => {
    const head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width">'
    expect(assemble(page('<p>x</p>', head)).ok).toBe(true)
  })

  it('refuses an empty assumptions list, and an assumption without a choice', () => {
    expect(refusedCodes(page('<p>x</p>'), { assumptions: [] })).toEqual(['no-assumptions'])
    const blankChoice = { assumptions: [{ choice: '  ', why: 'because' }] }
    expect(refusedCodes(page('<p>x</p>'), blankChoice)).toEqual(['empty-assumption-choice'])
  })

  it('reports every problem at once, so Claude fixes them in one go', () => {
    const body = '<img src="https://a.example/x.png"><a href="https://b.example">b</a>'
    const codes = refusedCodes(page(body, '<base href="#">'), { assumptions: [] })
    expect(codes).toEqual(expect.arrayContaining(['external-reference', 'forbidden-element', 'no-assumptions']))
  })

  it('does not mistake script text for an attribute', () => {
    const script = '<script>const a = el.href; el.src = next; if (x) { link.href = pick }</script>'
    expect(assemble(page(script)).ok).toBe(true)
  })
})

describe('Prototype assembly: what is accepted', () => {
  it('accepts in-page anchors, including a bare #', () => {
    const result = accepted(page('<a href="#top">up</a><a href="#">here</a><svg><use href="#icon"></use></svg>'))
    expect(result.html).toContain('href="#top"')
  })

  it('accepts a CSS url() pointing at an in-page anchor', () => {
    expect(assemble(page('<svg style="fill: url(#gradient)"></svg>')).ok).toBe(true)
  })

  it('inlines each images/N reference as a data URI, in attributes, srcset and CSS', () => {
    const body =
      '<img src="images/1"><img srcset="images/1 1x, images/2 2x"><div style="background: url(images/2)"></div>' +
      '<style>.hero { background-image: url("images/1") }</style>'
    const result = accepted(page(body))
    expect(result.html).toContain(`<img src="data:image/png;base64,${PIXEL}">`)
    expect(result.html).toContain(`data:image/png;base64,${PIXEL} 1x, data:image/jpeg;base64,AAAA 2x`)
    expect(result.html).toContain('background: url("data:image/jpeg;base64,AAAA")')
    expect(result.html).toContain(`.hero { background-image: url("data:image/png;base64,${PIXEL}") }`)
    expect(result.html).not.toMatch(/images\/\d/)
  })

  it('escapes a double quote when it re-quotes a srcset that held one, so it cannot start an attribute', () => {
    const inlined = accepted(page(`<img srcset='images/1 1x" src=http://evil.test/p.png y="'>`)).html
    expect(inlined).toContain(`data:image/png;base64,${PIXEL} 1x&quot; src=http://evil.test/p.png y=&quot;"`)
    expect(inlined).not.toContain('1x" src')
    const spaced = accepted(page(`<img srcset='#a"  src=http://evil.test/p.png y="'>`)).html
    expect(spaced).toContain('srcset="#a&quot; src=http://evil.test/p.png y=&quot;"')
    expect(spaced).not.toContain('#a" src')
  })

  it('reports which Image numbers the page uses, once each and in order', () => {
    const result = accepted(page('<img src="images/2"><img src="images/1"><img src="images/2">'))
    expect(result.usedImages).toEqual([1, 2])
  })

  it('reports no used Images when the page uses none', () => {
    expect(accepted(page('<p>No pictures</p>')).usedImages).toEqual([])
  })
})

describe('Prototype assembly: the stored page', () => {
  it('places the Content-Security-Policy meta first in <head>', () => {
    const { html } = accepted(page('<p>x</p>', '<meta charset="utf-8"><title>T</title>'))
    const head = html.slice(html.indexOf('<head>') + '<head>'.length)
    expect(head.startsWith(`<meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`)).toBe(true)
  })

  it('writes the agreed policy', () => {
    expect(PROTOTYPE_CSP).toBe(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'",
    )
    expect(PROTOTYPE_VIEW_CSP).toBe(`sandbox allow-scripts allow-forms allow-modals; ${PROTOTYPE_CSP}`)
  })

  it('adds a <head> with the policy when the page has none, and when it is a bare fragment', () => {
    const noHead = accepted('<!doctype html><html><body><p>x</p></body></html>').html
    expect(noHead).toMatch(/<html><head><meta http-equiv="Content-Security-Policy"/)
    const fragment = accepted('<p>just a fragment</p>').html
    expect(fragment.startsWith('<head><meta http-equiv="Content-Security-Policy"')).toBe(true)
    expect(fragment).toContain('<p>just a fragment</p>')
  })

  const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`

  const DOC = '<!doctype html>'
  const HEAD = '<head><title>T</title></head>'
  it.each([
    ['a comment before the doctype', `<!-- <head> -->${DOC}<html>${HEAD}<body></body></html>`],
    ['a comment between html and head', `${DOC}<html><!-- <head> -->${HEAD}<body></body></html>`],
    ['a comment that is never closed', `${DOC}<html>${HEAD}<body><!-- <head>`],
    ['a <head> inside a script, before the page', `<script>var a = "<head>"</script>${DOC}<html>${HEAD}</html>`],
    ['a <head> in a quoted attribute of <html>', `${DOC}<html lang="<head>"><body></body></html>`],
    ['text before <head>', `hello${HEAD}<body></body>`],
    ['a <head> after body content', `${DOC}<html><body><p>x</p>${HEAD}</body></html>`],
  ])('puts the policy in the effective head despite %s', (_name, source) => {
    const { html } = accepted(source)
    // The policy meta comes before every tag of the page itself, and sits directly inside a <head> the browser opens.
    const metaAt = html.indexOf(CSP_META)
    expect(metaAt).toBeGreaterThan(-1)
    const before = html.slice(0, metaAt).replace(/<!--[\s\S]*?-->/g, '')
    expect(before).toMatch(/(?:^|<!doctype[^>]*>|<html(?:"[^"]*"|[^>"])*>)\s*<head>$/i)
  })

  it('puts the policy before the first script when <head> has a stray quote in an unquoted value', () => {
    const source = '<head x=a"b><script>doEvil()</script><title>t</title></head><body class="c">"</body>'
    const { html } = accepted(source)
    expect(html.indexOf(CSP_META)).toBeGreaterThan(-1)
    expect(html.indexOf(CSP_META)).toBeLessThan(html.indexOf('<script>doEvil()'))
  })

  it('keeps the doctype first when the page has no <head>', () => {
    expect(accepted('<!DOCTYPE html><p>x</p>').html.startsWith('<!DOCTYPE html><head>')).toBe(true)
  })

  it('adds the Assumptions panel before </body>, with the count and every choice and reason', () => {
    const two = [
      { choice: 'Sample devices are invented', why: 'The Draft names no example data.' },
      { choice: 'Archive needs no reason', why: 'Not stated in the Draft.' },
    ]
    const result = assemblePrototype({ source: page('<p>x</p>'), assumptions: two, images })
    if (!result.ok) throw new Error('expected acceptance')
    const panel = result.html.slice(result.html.indexOf('Assumptions (2)') - 400, result.html.indexOf('</body>'))
    expect(result.html.indexOf('Assumptions (2)')).toBeGreaterThan(result.html.indexOf('<p>x</p>'))
    expect(result.html.indexOf('Assumptions (2)')).toBeLessThan(result.html.indexOf('</body>'))
    expect(panel).toContain('Sample devices are invented')
    expect(panel).toContain('The Draft names no example data.')
    expect(panel).toContain('Archive needs no reason')
    expect(panel).toContain('Not stated in the Draft.')
  })

  it('styles the panel inline only, with no <style>, <script> or class of its own', () => {
    const { html } = accepted(page('<p>x</p>'))
    const panel = html.slice(html.indexOf('id="grillingstone-assumptions"'), html.indexOf('</body>'))
    expect(panel).toContain('style="')
    expect(panel).not.toMatch(/<style|<script|class=/)
  })

  it('escapes assumption text, so Claude cannot inject markup through the panel', () => {
    const risky = [{ choice: '<img src=x onerror=alert(1)>', why: 'a & b "quoted"' }]
    const result = assemblePrototype({ source: page('<p>x</p>'), assumptions: risky, images })
    if (!result.ok) throw new Error('expected acceptance')
    expect(result.html).not.toContain('<img src=x')
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(result.html).toContain('a &amp; b &quot;quoted&quot;')
  })

  it('puts the panel at the end when the page has no </body>', () => {
    const { html } = accepted('<p>fragment</p>')
    expect(html.endsWith('</details>')).toBe(true)
    expect(html).toContain('Assumptions (1)')
  })

  it('uses the last </body> when the text mentions one earlier', () => {
    const { html } = accepted(page('<script>var tail = "</body>"</script>'))
    expect(html.indexOf('Assumptions (1)')).toBeGreaterThan(html.indexOf('</body>"</script>'))
  })
})

describe('Prototype assembly: hostile input takes time in proportion to its size', () => {
  // Pages Claude writes can be large, so there is no size cap to lean on: every scan must be linear.
  const BUDGET_MS = 1000
  it.each([
    ['"url(" followed by white space and no ")"', 'url(' + ' '.repeat(200_000)],
    ['many "url(" and a single ")" at the end', 'url('.repeat(50_000) + ')'],
    ['many tag starts with no ">"', '<a'.repeat(100_000)],
    ['many <meta starts with no ">"', '<meta '.repeat(40_000)],
    ['many "<!" with no ">"', '<!'.repeat(100_000)],
    ['many open quotes in tags', '<a x="'.repeat(50_000)],
    ['many "<" and ">" pairs', '<a>'.repeat(60_000)],
    ['many unclosed <script> starts', '<script>'.repeat(50_000)],
    ['many unclosed <textarea> starts', '<textarea>x'.repeat(50_000)],
    ['many closed <style> elements', '<style>a</style>'.repeat(40_000)],
    ['many <title> starts and one late end', '<title>'.repeat(50_000) + '</title>'],
    ['many "&#" references', '<meta http-equiv="' + '&#1'.repeat(60_000) + '">'],
  ])('assembles %s within the time budget', (_name, hostile) => {
    const started = performance.now()
    assemble(page(hostile))
    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
  })
})
