// Tests for the Project board's filters: the last-week default, each filter, and Reset going back to the default.
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { DEFAULT_DRAFT_FILTERS, draftMatches, useDraftFilters } from '@/hooks/drafts/useDraftFilters'

const NOW = new Date('2026-11-05T12:00:00Z').getTime()

const draft = (patch: Partial<DraftSummary> = {}): DraftSummary => ({
  id: 'd1',
  projectId: 'p',
  title: 'Archive devices',
  requirement: 'Managers archive devices.',
  workItemType: 'PBI',
  version: 1,
  templateName: 'Default PBI Template',
  pendingChanges: 0,
  changedBacklogCopies: [],
  lane: 'review',
  archived: false,
  updatedAt: '2026-11-04T12:00:00Z',
  ...patch,
})

describe('draftMatches', () => {
  it('shows only Drafts updated in the last 7 days by default', () => {
    expect(draftMatches(draft(), DEFAULT_DRAFT_FILTERS, NOW)).toBe(true)
    expect(draftMatches(draft({ updatedAt: '2026-10-28T12:00:00Z' }), DEFAULT_DRAFT_FILTERS, NOW)).toBe(false)
    expect(
      draftMatches(draft({ updatedAt: '2026-10-28T12:00:00Z' }), { ...DEFAULT_DRAFT_FILTERS, updatedWithin: 0 }, NOW),
    ).toBe(true)
  })

  it('filters by search, Needs you, Type and Template', () => {
    const filters = { ...DEFAULT_DRAFT_FILTERS, updatedWithin: 0 as const }
    expect(draftMatches(draft(), { ...filters, query: 'MANAGERS' }, NOW)).toBe(true)
    expect(draftMatches(draft(), { ...filters, query: 'billing' }, NOW)).toBe(false)
    expect(draftMatches(draft(), { ...filters, needsOnly: true }, NOW)).toBe(false)
    expect(draftMatches(draft({ pendingChanges: 2 }), { ...filters, needsOnly: true }, NOW)).toBe(true)
    expect(draftMatches(draft(), { ...filters, types: ['Bug'] }, NOW)).toBe(false)
    expect(draftMatches(draft(), { ...filters, templates: ['Default PBI Template'] }, NOW)).toBe(true)
  })
})

describe('useDraftFilters', () => {
  it('resets to the last-week default, not to everything', () => {
    const { result } = renderHook(() => useDraftFilters())
    expect(result.current.changed).toBe(false)
    act(() => result.current.setUpdatedWithin(0))
    act(() => result.current.toggleType('Bug'))
    expect(result.current.changed).toBe(true)
    act(() => result.current.reset())
    expect(result.current.filters).toEqual(DEFAULT_DRAFT_FILTERS)
    expect(result.current.filters.updatedWithin).toBe(7)
  })
})
