import { describe, expect, it } from 'vitest'

import { buildTemplateSeed } from '#core/session/templateSessionSeed.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

const submitCommand = 'node "/tool/scripts/writeDraft.mjs"'

describe('Template Session seed', () => {
  it('tells Claude which Work Item Type the Template is for and what the human wants it for', () => {
    const seed = buildTemplateSeed({
      workItemType: 'PBI',
      purpose: 'Spike PBIs: timeboxed investigations ending in a recommendation',
      examples: '',
      submitCommand,
    })
    const all = seed.systemPrompt + seed.firstMessage
    expect(all).toContain('PBI')
    expect(all).toContain('Spike PBIs: timeboxed investigations ending in a recommendation')
  })

  const seedText = (extra: Partial<Parameters<typeof buildTemplateSeed>[0]> = {}) => {
    const s = buildTemplateSeed({ workItemType: 'PBI', purpose: 'Spike PBIs', examples: '', submitCommand, ...extra })
    return s.systemPrompt + '\n' + s.firstMessage
  }

  it("offers only the Azure DevOps fields the type's form shows, and lets Claude place the Iteration Log", () => {
    const bug = seedText({ workItemType: 'Bug' })
    expect(bug).toContain(
      '"Microsoft.VSTS.TCM.ReproSteps" | "Microsoft.VSTS.TCM.SystemInfo" | "Microsoft.VSTS.Common.AcceptanceCriteria"',
    )
    expect(bug).toContain('(Repro Steps, System Info or Acceptance Criteria)')
    expect(bug).not.toContain('System.Description')
    expect(bug).toMatch(/"iterationLogTarget": one of those fields/)
    expect(seedText({ workItemType: 'Task' })).not.toContain('AcceptanceCriteria"')
  })

  it('asks for a method with the required skeleton and good and bad examples', () => {
    const all = seedText()
    for (const part of ['Purpose', 'Guiding principle', 'Sections', 'Working process']) expect(all).toContain(part)
    expect(all).toMatch(/Good example/)
    expect(all).toMatch(/Bad example/)
  })

  it('walks the decision tree in the agreed order', () => {
    const all = seedText()
    const order = [
      'purpose and audience',
      'Section list',
      'Locked',
      'target field',
      'rules and examples',
      'guiding principle',
    ].map((p) => all.indexOf(p))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('passes the pasted examples and the base Template as read-only starting material', () => {
    const all = seedText({ examples: 'Spike: Can the bulk endpoint handle 5,000 devices?', base: defaultPbiTemplate })
    expect(all).toContain('Can the bulk endpoint handle 5,000 devices?')
    expect(all).toContain('Default PBI Template')
    expect(all).toContain('acceptanceCriteria')
    expect(all).toContain('Frontend PBI Guide')
    expect(all).toMatch(/new Template/)
  })

  it('shows how to submit the Template through the submit command, gated on the human confirming', () => {
    const all = seedText()
    expect(all).toContain(`${submitCommand} <<'WHETSTONE_JSON'`)
    expect(all).toContain('"sections"')
    expect(all).toContain('Write it now.')
    expect(all).toContain('pbi-question')
    expect(all).toContain('pbi-ready')
  })

  it('carries no Project or Glossary — Templates are reused across Projects', () => {
    const all = seedText()
    expect(all).not.toMatch(/CONTEXT\.md/)
    expect(all).toMatch(/no Project/i)
  })
})
