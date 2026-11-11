// Tests for turning Azure DevOps rich text back into Section markdown, including the round trip through markdownHtml.
import { describe, expect, it } from 'vitest'

import { htmlBlocks, htmlToMarkdown } from '#core/shared/htmlMarkdown.ts'
import { markdownToHtml } from '#core/shared/markdownHtml.ts'

describe('htmlToMarkdown', () => {
  it.each([
    'One paragraph.',
    'Two lines\nin one paragraph.',
    'First paragraph.\n\nSecond paragraph.',
    '- one\n- two',
    '1. one\n2. two',
    '| Action | Admin |\n| --- | --- |\n| Archive | ✅ |',
    'Use **bold**, `code` and [a link](https://example.com/x).',
    'Escaped <tags> & "quotes" stay text.',
  ])('round-trips %j through markdownToHtml', (markdown) => {
    expect(htmlToMarkdown(markdownToHtml(markdown))).toBe(markdown)
  })

  it('reads what the Azure DevOps editor writes: divs, nbsp, spans and stray markup', () => {
    const html =
      '<div><span style="color:red">Hello&nbsp;world</span></div><div>second&#160;<b>line</b></div><div><br></div>'
    expect(htmlToMarkdown(html)).toBe('Hello world\n\nsecond **line**')
  })

  it('keeps headings as their own blocks and drops scripts, styles and unsafe links', () => {
    const blocks = htmlBlocks(
      '<h2>Scope</h2><p>x <a href="javascript:alert(1)">bad</a></p><script>alert(1)</script><style>p{}</style>',
    )
    expect(blocks).toEqual([
      { kind: 'heading', text: 'Scope' },
      { kind: 'paragraph', lines: ['x bad'] },
    ])
  })

  it('tolerates unclosed and stray tags', () => {
    expect(htmlToMarkdown('<p>open <strong>bold</p></span><p>next')).toBe('open **bold**\n\nnext')
  })

  it('is empty for nothing', () => {
    expect(htmlToMarkdown(undefined)).toBe('')
    expect(htmlToMarkdown('<p> </p>')).toBe('')
  })
})
