// Tests for the fields "Copy for <Tracker>" offers: their labels, order and formats per Tracker.
import { describe, expect, it } from 'vitest'

import type { Draft } from '#core/draft/draftTypes.ts'
import { copyFields } from '#core/publish/copyFields.ts'
import { customFieldTarget, JIRA_FIELDS, type SectionTarget } from '#core/shared/trackerFields.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

/** The fixture Draft as a Jira Story, every Section in Description unless `targets` says otherwise. */
const jiraDraft = (targets: Record<string, SectionTarget> = {}): Draft => {
  const draft = v1Draft()
  const toJira = <T extends { key: string; target: SectionTarget }>(section: T) => ({
    ...section,
    target: targets[section.key] ?? JIRA_FIELDS.description,
  })
  return {
    ...draft,
    workItemType: 'Story',
    sections: draft.sections.map(toJira),
    template: {
      ...draft.template,
      tracker: 'jira',
      workItemType: 'Story',
      sections: draft.template.sections.map(toJira),
    },
  }
}

describe('copyFields', () => {
  it('offers Azure DevOps Title, Description and Acceptance Criteria as rich text only', () => {
    const payload = copyFields(v1Draft())
    expect(payload.tracker).toBe('azure-devops')
    expect(payload.fields.map((field) => field.label)).toEqual(['Title', 'Description', 'Acceptance Criteria'])
    expect(payload.fields.every((field) => field.wiki === null)).toBe(true)
    expect(payload.fields[0]).toMatchObject({ html: null, text: 'Archive device from device list' })
  })

  it('offers a Jira Story as Summary and Description, each also as wiki markup', () => {
    const payload = copyFields(jiraDraft())
    expect(payload.tracker).toBe('jira')
    expect(payload.fields.map((field) => field.label)).toEqual(['Summary', 'Description'])
    expect(payload.fields[1].html).toContain('<h2>Acceptance Criteria</h2>')
    expect(payload.fields[1].wiki).toContain('h2. Acceptance Criteria')
    expect(payload.fields[0].wiki).toBe('Archive device from device list')
  })

  it("puts Jira's own fields before Custom Fields", () => {
    const payload = copyFields(
      jiraDraft({ acceptanceCriteria: customFieldTarget('Acceptance Criteria'), design: JIRA_FIELDS.environment }),
    )
    expect(payload.fields.map((field) => field.label)).toEqual([
      'Summary',
      'Description',
      'Environment',
      'Acceptance Criteria',
    ])
  })
})
