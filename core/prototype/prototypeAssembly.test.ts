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
