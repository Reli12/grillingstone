// Tests for useGlossaryFilter: which terms are listed for the filter text, and which stay listed regardless.
import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useGlossaryFilter } from '@/hooks/glossary/useGlossaryFilter'
import { renderHook } from '@test/utils/testUtils'

const terms = [
  { term: 'Device', definition: 'A metered unit.', avoid: 'asset' },
  { term: 'Glossary', definition: 'The shared domain terms.', avoid: 'dictionary' },
  { term: 'Site', definition: 'Where devices live.', avoid: '' },
]
const names = (rows: { term: { term: string } }[]) => rows.map((row) => row.term.term)

describe('useGlossaryFilter', () => {
  it('lists every term with its place in the Glossary while the filter is empty', () => {
    const { result } = renderHook(() => useGlossaryFilter())
    expect(result.current.rowsOf(terms).map((row) => row.index)).toEqual([0, 1, 2])
  })

  it('lists only matching terms, keeping their place in the whole Glossary', () => {
    const { result } = renderHook(() => useGlossaryFilter())
    act(() => result.current.setQuery('DICTIONARY'))
    expect(result.current.rowsOf(terms)).toEqual([{ term: terms[1], index: 1 }])
    act(() => result.current.setQuery('devices'))
    expect(names(result.current.rowsOf(terms))).toEqual(['Site'])
  })

  it('keeps the term being edited listed', () => {
    const { result } = renderHook(() => useGlossaryFilter())
    act(() => result.current.setQuery('glossary'))
    expect(names(result.current.rowsOf(terms, 'site'))).toEqual(['Glossary', 'Site'])
  })

  it('keeps a just-saved term listed until the filter text changes', () => {
    const { result } = renderHook(() => useGlossaryFilter())
    act(() => result.current.setQuery('glossary'))
    act(() => result.current.keep('Device'))
    expect(names(result.current.rowsOf(terms))).toEqual(['Device', 'Glossary'])
    act(() => result.current.setQuery('glossar'))
    expect(names(result.current.rowsOf(terms))).toEqual(['Glossary'])
  })

  it('clears the filter text', () => {
    const { result } = renderHook(() => useGlossaryFilter())
    act(() => result.current.setQuery('site'))
    act(() => result.current.clear())
    expect(result.current.query).toBe('')
    expect(result.current.rowsOf(terms)).toHaveLength(3)
  })
})
