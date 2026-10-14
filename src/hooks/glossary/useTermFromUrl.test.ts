// Tests for useTermFromUrl: a ?term= link scrolls to its term and highlights it briefly, once.
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addTerm, termAnchor } from '#core/glossary/glossary.ts'

import { useTermFromUrl } from '@/hooks/glossary/useTermFromUrl'
import { renderHook } from '@test/utils/testUtils'

const glossary = addTerm('', { term: 'Archived Device', definition: 'Hidden, still billed.', avoid: '' }, 'Portal')
const scrollIntoView = vi.fn()

describe('useTermFromUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const row = document.createElement('div')
    row.id = termAnchor('Archived Device')
    row.scrollIntoView = scrollIntoView
    document.body.append(row)
  })
  afterEach(() => {
    vi.useRealTimers()
    scrollIntoView.mockClear()
    document.body.replaceChildren()
  })

  it('scrolls to the linked term, matched ignoring case, and highlights it for two seconds', () => {
    const { result } = renderHook(() => useTermFromUrl(glossary), { route: '/?term=archived%20device' })
    expect(result.current).toBe('Archived Device')
    expect(scrollIntoView).toHaveBeenCalledOnce()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBeNull()
  })

  it('waits for the Glossary to load', () => {
    const loaded: { markdown?: string } = {}
    const { result, rerender } = renderHook(() => useTermFromUrl(loaded.markdown), {
      route: '/?term=Archived%20Device',
    })
    expect(result.current).toBeNull()
    loaded.markdown = glossary
    rerender()
    expect(result.current).toBe('Archived Device')
  })

  it('looks the link up once, so a later live update never scrolls again', () => {
    let markdown = glossary
    const { result, rerender } = renderHook(() => useTermFromUrl(markdown), { route: '/?term=Archived%20Device' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    markdown = addTerm(glossary, { term: 'Site', definition: 'Where devices live.', avoid: '' })
    rerender()
    expect(result.current).toBeNull()
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('ignores a term that does not exist, and a page without a link', () => {
    expect(renderHook(() => useTermFromUrl(glossary), { route: '/?term=Foo' }).result.current).toBeNull()
    expect(renderHook(() => useTermFromUrl(glossary)).result.current).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
