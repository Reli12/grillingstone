import { describe, expect, it } from 'vitest'
import { wordDiff } from '@/lib/wordDiff'

describe('wordDiff', () => {
  it('marks removed and added words, keeping shared ones', () => {
    expect(wordDiff('usage up to the archive timestamp', 'usage up to each archive timestamp')).toEqual([
      { op: 'same', text: 'usage up to ' },
      { op: 'del', text: 'the' },
      { op: 'add', text: 'each' },
      { op: 'same', text: ' archive timestamp' },
    ])
  })

  it('handles additions to empty text and line breaks', () => {
    expect(wordDiff('', 'Given x')).toEqual([{ op: 'add', text: 'Given x' }])
    expect(wordDiff('a\nb', 'a\nc').map((p) => p.op)).toEqual(['same', 'del', 'add'])
  })
})
