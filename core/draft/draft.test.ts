// Tests for a new Draft: it remembers the Prototype it was created from, only when there is one.
import { describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

const args = {
  projectId: 'proj-1',
  workItemType: 'PBI' as const,
  template: defaultPbiTemplate,
  requirement: 'Archive a device',
  now: '2026-10-27T10:00:00Z',
}

describe('newDraft', () => {
  it('records the Prototype the Draft was created from', () => {
    const draft = newDraft({ ...args, createdFromPrototypeId: 'proto-1' })
    expect(draft.createdFromPrototypeId).toBe('proto-1')
    expect(draft.version).toBe(0)
    expect(draft.requirement).toBe('Archive a device')
  })

  it('has no createdFromPrototypeId key when created from none', () => {
    expect(newDraft(args)).not.toHaveProperty('createdFromPrototypeId')
    expect(newDraft({ ...args, createdFromPrototypeId: '' })).not.toHaveProperty('createdFromPrototypeId')
  })
})
