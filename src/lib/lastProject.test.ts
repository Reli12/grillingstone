import { afterEach, describe, expect, it, vi } from 'vitest'

import { lastProject, rememberProject } from '@/lib/lastProject'

describe('lastProject', () => {
  afterEach(() => vi.restoreAllMocks())

  it('remembers the last Project', () => {
    expect(lastProject()).toBeNull()
    rememberProject('billing')
    expect(lastProject()).toBe('billing')
  })

  it('degrades quietly without storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => rememberProject('billing')).not.toThrow()
    expect(lastProject()).toBeNull()
  })
})
