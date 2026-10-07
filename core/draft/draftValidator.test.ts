// Tests for the Draft Validator: which submitted Draft content passes its Template, and why the rest is refused.
import { describe, expect, it } from 'vitest'

import type { DraftContent } from '#core/draft/draftTypes.ts'
import { validate } from '#core/draft/draftValidator.ts'
import { defaultPbiTemplate, validPbiContent } from '#core/testing/fixtures.ts'

const reasonCodes = (content: DraftContent) => {
  const result = validate(defaultPbiTemplate, content)
  if (result.ok) return []
  return result.reasons.map((reason) => {
    const where = reason.sectionKey ? `:${reason.sectionKey}` : ''
    return `${reason.code}${where}`
  })
}

describe('Draft Validator', () => {
  it('accepts a v1 that fills every Template Section in order', () => {
    expect(validate(defaultPbiTemplate, validPbiContent())).toEqual({ ok: true })
  })

  it('refuses a Draft that omits a Template Section, naming it', () => {
    const content = validPbiContent()
    content.sections = content.sections.filter((section) => section.key !== 'design')
    expect(reasonCodes(content)).toEqual(['missing-section:design'])
  })

  it('refuses a Draft without a Title', () => {
    expect(reasonCodes({ ...validPbiContent(), title: '   ' })).toEqual(['missing-title'])
  })

  it('refuses Sections out of Template order', () => {
    const content = validPbiContent()
    const ac = content.sections.pop()!
    content.sections.unshift(ac)
    expect(reasonCodes(content)).toEqual(['section-order'])
  })

  it('refuses Sections the Template does not define, and duplicates', () => {
    const content = validPbiContent()
    content.sections.push({ key: 'notInTemplate', body: 'x' }, { ...content.sections[0] })
    expect(reasonCodes(content)).toEqual(['unknown-section:notInTemplate', 'duplicate-section:userStory'])
  })

  it('refuses an empty Locked Section, even with an N/A reason', () => {
    const content = validPbiContent()
    content.sections[0].body = 'N/A — nothing to say'
    content.sections[8].entries = []
    expect(reasonCodes(content)).toEqual(['empty-locked-section:userStory', 'empty-locked-section:acceptanceCriteria'])
  })

  it('requires an empty Section to say "N/A — reason"', () => {
    const content = validPbiContent()
    content.sections[1].body = ''
    content.sections[5] = { key: 'dependencies', entries: [] }
    content.sections[7].body = 'N/A'
    expect(reasonCodes(content)).toEqual([
      'empty-without-reason:roles',
      'empty-without-reason:dependencies',
      'empty-without-reason:design',
    ])
  })

  it('accepts an empty entries Section that gives its reason in the body', () => {
    const content = validPbiContent()
    content.sections[5] = { key: 'dependencies', body: 'N/A - no backend work needed', entries: [] }
    expect(validate(defaultPbiTemplate, content)).toEqual({ ok: true })
  })

  it('refuses content in the wrong shape for its Section', () => {
    const content = validPbiContent()
    content.sections[0] = { key: 'userStory', entries: [{ title: 'Story', body: 'As a Manager…' }] }
    content.sections[2] = { key: 'scope', body: 'In scope: archive a single device' }
    expect(reasonCodes(content)).toEqual(['wrong-shape:userStory', 'wrong-shape:scope'])
  })

  it('refuses Entries without a title or body', () => {
    const content = validPbiContent()
    content.sections[5].entries = [
      { title: '', body: 'PATCH /devices/{id}/archive' },
      { title: 'Blocked by', body: ' ' },
    ]
    const result = validate(defaultPbiTemplate, content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.map((reason) => reason.code)).toEqual(['malformed-entry', 'malformed-entry'])
      expect(result.reasons[1].message).toContain('Blocked by')
    }
  })

  it('refuses an Acceptance Criterion that is not Given / When / Then', () => {
    const content = validPbiContent()
    content.sections[8].entries![1] = {
      title: 'AC02 - Billing',
      body: 'Archived devices are billed until the archive timestamp.',
    }
    const result = validate(defaultPbiTemplate, content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons).toHaveLength(1)
      expect(result.reasons[0]).toMatchObject({ code: 'malformed-entry', sectionKey: 'acceptanceCriteria' })
      expect(result.reasons[0].message).toMatch(/AC02 - Billing.*Given/)
    }
  })

  it('refuses submissions that are not Draft content at all instead of crashing', () => {
    for (const junk of [null, 'text', { title: 'x' }, { title: 'x', sections: [1, { key: 3 }] }]) {
      const result = validate(defaultPbiTemplate, junk as never)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reasons[0].code).toBe('malformed-content')
    }
  })
})
