// Tests for the markdown → Jira wiki markup converter used for Jira Data Center's Text mode.
import { describe, expect, it } from 'vitest'

import { escapeWiki, inlineWiki, markdownToWiki } from '#core/shared/markdownWiki.ts'

describe('markdownToWiki', () => {
  it.each([
    ['a paragraph with a line break', 'First line\nsecond line', 'First line\nsecond line'],
    ['bullets', '- one\n* two', '* one\n* two'],
    ['numbered items', '1. one\n2) two', '# one\n# two'],
    ['a table', '| A | B |\n| --- | --- |\n| 1 | 2 |', '||A||B||\n|1|2|'],
    ['blocks apart by a blank line', 'One\n\nTwo', 'One\n\nTwo'],
  ])('renders %s', (_, markdown, wiki) => {
    expect(markdownToWiki(markdown)).toBe(wiki)
  })
})

describe('inlineWiki', () => {
  it('turns **bold**, `code` and links into wiki markup', () => {
    expect(inlineWiki('**Given** a `PATCH` to [the API](https://example.com/api)')).toBe(
      '*Given* a {{PATCH}} to [the API|https://example.com/api]',
    )
  })

  it('escapes characters Jira would read as formatting', () => {
    expect(inlineWiki('a_b *c* {x} [y] | ! ^ ~ +')).toBe('a\\_b \\*c\\* \\{x\\} \\[y\\] \\| \\! \\^ \\~ \\+')
  })

  it('escapes a leading dash or hash, which would start a list', () => {
    expect(escapeWiki('- not a list')).toBe('\\- not a list')
    expect(escapeWiki('# not a heading')).toBe('\\# not a heading')
  })
})
