// Tests for mapping an Azure DevOps work item to the tool's view, and on to a Refresh and an Import.
import { describe, expect, it } from 'vitest'

import { adoMarkdown, importedRequirement, mapWorkItem, toPastedCopy, toRepaste } from '#core/ado/workItemMapping.ts'
import { ADO_FIELD_LABELS, ADO_FIELDS } from '#core/shared/adoFields.ts'

const ORG = 'https://dev.azure.com/abysalto'

const response = {
  id: 1234,
  rev: 7,
  fields: {
    'System.WorkItemType': 'Product Backlog Item',
    'System.Title': 'Archive device',
    'System.TeamProject': 'Customer Portal',
    'System.AreaPath': 'Customer Portal\\Devices',
    'System.IterationPath': 'Customer Portal\\Sprint 4',
    'System.State': 'New',
    'System.Tags': 'frontend; sems',
    [ADO_FIELDS.description]: '<div>BR1 — A Manager can archive.</div>',
    [ADO_FIELDS.acceptanceCriteria]: '<ul><li>AC1</li></ul>',
  },
  relations: [{ rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${ORG}/_apis/wit/workItems/1000` }],
}

describe('Work item mapping', () => {
  it('maps type, fields, parent, area, tags and the link', () => {
    expect(mapWorkItem(response, ORG)).toEqual({
      id: 1234,
      rev: 7,
      adoType: 'Product Backlog Item',
      workItemType: 'PBI',
      title: 'Archive device',
      fields: {
        [ADO_FIELDS.description]: '<div>BR1 — A Manager can archive.</div>',
        [ADO_FIELDS.acceptanceCriteria]: '<ul><li>AC1</li></ul>',
      },
      parentId: 1000,
      teamProject: 'Customer Portal',
      areaPath: 'Customer Portal\\Devices',
      iterationPath: 'Customer Portal\\Sprint 4',
      state: 'New',
      tags: ['frontend', 'sems'],
      url: `${ORG}/Customer%20Portal/_workitems/edit/1234`,
    })
  })

  it('prefers System.Parent, and has no parent or tool type when Azure DevOps has none', () => {
    const item = mapWorkItem(
      { id: 1, rev: 1, fields: { 'System.WorkItemType': 'Impediment', 'System.Parent': 55 }, relations: null },
      ORG,
    )
    expect(item.parentId).toBe(55)
    expect(item.workItemType).toBeNull()
    expect(mapWorkItem({ id: 2, rev: 1, fields: {} }, ORG).parentId).toBeNull()
  })

  it('turns the item into a re-paste and a pasted Copy for Refresh', () => {
    const item = mapWorkItem(response, ORG)
    expect(toRepaste(item)).toEqual({
      title: 'Archive device',
      workItemType: 'PBI',
      content: 'BR1 — A Manager can archive.',
      acceptanceCriteria: '- AC1',
    })
    expect(toPastedCopy(item)).toMatchObject({ workItem: item.url, workItemType: 'PBI', title: 'Archive device' })
  })

  it('reads a Bug from its Repro Steps and System Info', () => {
    const bug = mapWorkItem(
      {
        id: 3,
        rev: 1,
        fields: {
          'System.WorkItemType': 'Bug',
          [ADO_FIELDS.reproSteps]: '<p>1. open</p>',
          [ADO_FIELDS.systemInfo]: '<p>Chrome</p>',
        },
      },
      ORG,
    )
    expect(toRepaste(bug).content).toBe('1. open\n\nSystem Info:\nChrome')
  })

  it('keeps every field of an Imported item, labelled, as the requirement', () => {
    expect(importedRequirement(mapWorkItem(response, ORG), ADO_FIELD_LABELS)).toBe(
      'Imported from Product Backlog Item #1234: Archive device\n\n## Description\n\nBR1 — A Manager can archive.\n\n## Acceptance Criteria\n\n- AC1',
    )
  })

  it('keeps the line breaks and headings of a field Azure DevOps holds as Markdown', () => {
    const markdown =
      'User Story\n----------\nAs an energy manager, I want…\n\nScope\n-----\n**In scope** Heat Map card\n\n* BR1\n* BR2\n\n### Notes\n1. one\n2. two'
    const item = mapWorkItem(
      {
        id: 5,
        rev: 1,
        fields: { 'System.WorkItemType': 'Feature', 'System.Title': 'Heat map', [ADO_FIELDS.description]: markdown },
        multilineFieldsFormat: { [ADO_FIELDS.description]: 'markdown' },
      },
      ORG,
    )
    expect(item.markdownFields).toEqual([ADO_FIELDS.description])
    expect(toRepaste(item).content).toBe(
      '## User Story\nAs an energy manager, I want…\n\n## Scope\n**In scope** Heat Map card\n\n* BR1\n* BR2\n\n## Notes\n1. one\n2. two',
    )
  })

  it('treats a field with line breaks and no HTML as Markdown even when the item does not say', () => {
    const item = mapWorkItem(
      { id: 6, rev: 1, fields: { 'System.WorkItemType': 'Feature', [ADO_FIELDS.description]: 'Line 1\nLine 2' } },
      ORG,
    )
    expect(toRepaste(item).content).toBe('Line 1\nLine 2')
    expect(adoMarkdown('A\r\n\r\n\r\n\r\nB')).toBe('A\n\nB')
  })
})
