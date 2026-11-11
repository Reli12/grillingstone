// Tests for which Azure DevOps projects can be a Project's Backlog.
import { describe, expect, it } from 'vitest'

import { backlogEligibility } from '#core/ado/backlogEligibility.ts'

const scrum = ['Epic', 'Feature', 'Product Backlog Item', 'Task', 'Bug', 'Impediment'].map((name) => ({ name }))

describe('Backlog eligibility', () => {
  it('accepts a Scrum project under its own spelling', () => {
    const lookup = { found: true as const, name: 'Customer Portal', types: scrum }
    expect(backlogEligibility('customer portal', 'abysalto', lookup)).toEqual({ ok: true, name: 'Customer Portal' })
  })

  it('refuses a project that does not exist', () => {
    expect(backlogEligibility('Nope', 'abysalto', { found: false })).toEqual({
      ok: false,
      reason: 'No Azure DevOps project "Nope" in abysalto. Check the spelling.',
    })
  })

  it('refuses an Agile project, and a Scrum-inherited one that disabled a type', () => {
    const agile = ['Epic', 'Feature', 'User Story', 'Task', 'Bug'].map((name) => ({ name }))
    expect(backlogEligibility('CRM', 'abysalto', { found: true, name: 'CRM', types: agile })).toEqual({
      ok: false,
      reason: 'CRM has no Product Backlog Item — its process must be Scrum or inherit from Scrum.',
    })
    const disabled = scrum.map((type) => (type.name === 'Bug' ? { ...type, isDisabled: true } : type))
    expect(backlogEligibility('X', 'abysalto', { found: true, name: 'X', types: disabled })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('has no Bug'),
    })
  })
})
