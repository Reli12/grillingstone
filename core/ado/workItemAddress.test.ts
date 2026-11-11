// Tests for reading what the human types to name an organization, a work item or an Azure DevOps project.
import { describe, expect, it } from 'vitest'

import { parseOrganization, parseProjectAddress, parseWorkItemAddress } from '#core/ado/workItemAddress.ts'

describe('Work item address', () => {
  it.each([
    ['https://dev.azure.com/Abysalto', 'abysalto'],
    ['https://dev.azure.com/abysalto/Customer%20Portal/_backlogs', 'abysalto'],
    ['https://abysalto.visualstudio.com/', 'abysalto'],
    ['abysalto', 'abysalto'],
  ])('reads the organization from %s', (input, organization) => {
    expect(parseOrganization(input)).toEqual({
      ok: true,
      organization,
      orgUrl: `https://dev.azure.com/${organization}`,
    })
  })

  it('refuses what is not an organization', () => {
    expect(parseOrganization('https://example.com/x').ok).toBe(false)
    expect(parseOrganization('').ok).toBe(false)
  })

  it.each([
    ['1234', 1234],
    ['#1234', 1234],
    ['https://dev.azure.com/abysalto/Portal/_workitems/edit/1234', 1234],
    ['https://dev.azure.com/abysalto/Portal/_workitems/edit/1234/?view=x', 1234],
  ])('reads work item %s', (input, workItemId) => {
    expect(parseWorkItemAddress(input, 'abysalto')).toEqual({ ok: true, workItemId })
  })

  it('refuses a work item link from another organization', () => {
    const parsed = parseWorkItemAddress('https://dev.azure.com/other/P/_workitems/edit/12', 'abysalto')
    expect(parsed).toMatchObject({ ok: false, reason: expect.stringContaining('"other"') })
  })

  it.each([
    ['Customer Portal', 'Customer Portal'],
    ['https://dev.azure.com/abysalto/Customer%20Portal/_backlogs/backlog', 'Customer Portal'],
    ['https://abysalto.visualstudio.com/Billing/_workitems/edit/3', 'Billing'],
  ])('reads the project from %s', (input, project) => {
    expect(parseProjectAddress(input, 'abysalto')).toEqual({ ok: true, project })
  })

  it('refuses project links that name no project, belong elsewhere or are not Azure DevOps', () => {
    expect(parseProjectAddress('https://dev.azure.com/abysalto/_settings', 'abysalto').ok).toBe(false)
    expect(parseProjectAddress('https://dev.azure.com/other/P', 'abysalto').ok).toBe(false)
    expect(parseProjectAddress('https://example.com/P', 'abysalto').ok).toBe(false)
    expect(parseProjectAddress('  ', 'abysalto').ok).toBe(false)
  })
})
