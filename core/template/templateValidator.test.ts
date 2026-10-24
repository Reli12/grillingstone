// Tests for the Template Validator, the gate every saved Template passes.
import { describe, expect, it } from 'vitest'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { customFieldTarget, JIRA_FIELDS } from '#core/shared/trackerFields.ts'
import { methodSkeleton, type TemplateContent, validateTemplate } from '#core/template/templateValidator.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

const content = (): TemplateContent =>
  structuredClone({
    workItemType: defaultPbiTemplate.workItemType,
    name: defaultPbiTemplate.name,
    sections: defaultPbiTemplate.sections,
    method: defaultPbiTemplate.method,
  })
const codes = (candidate: unknown, opts?: Parameters<typeof validateTemplate>[1]) => {
  const result = validateTemplate(candidate, opts)
  if (result.ok) return []
  return result.reasons.map((reason) => {
    const where = reason.sectionKey ? `:${reason.sectionKey}` : ''
    return `${reason.code}${where}`
  })
}

describe('Template Validator', () => {
  it('accepts a well-formed Template', () => {
    expect(validateTemplate(defaultPbiTemplate)).toEqual({ ok: true })
  })

  it('needs a name, a method and at least one Section', () => {
    expect(codes({ workItemType: 'PBI', name: ' ', sections: [], method: '' })).toEqual([
      'missing-name',
      'no-sections',
      'missing-method',
    ])
  })

  it('refuses malformed, duplicate or headless Section keys', () => {
    const candidate = content()
    candidate.sections[1] = { ...candidate.sections[1], key: 'user story' }
    candidate.sections[2] = { ...candidate.sections[2], key: 'userStory' }
    candidate.sections[3] = { ...candidate.sections[3], heading: '' }
    expect(codes(candidate)).toEqual([
      'bad-key:user story',
      'duplicate-key:userStory',
      'missing-heading:reusedPatterns',
    ])
  })

  it('refuses unknown target fields and shapes, and Given/When/Then on prose', () => {
    const candidate = content()
    candidate.sections[0] = { ...candidate.sections[0], target: 'System.History' as never }
    candidate.sections[1] = { ...candidate.sections[1], shape: 'table' as never }
    candidate.sections[6] = { ...candidate.sections[6], entryFormat: 'gherkin' }
    expect(codes(candidate)).toEqual(['unknown-target:userStory', 'bad-shape:roles', 'gherkin-on-prose:technicalNotes'])
  })

  describe('fields per Work Item Type', () => {
    it('refuses a PBI Section published into Repro Steps, naming the fields a PBI may use', () => {
      const candidate = { ...content(), workItemType: 'PBI' }
      candidate.sections[0] = { ...candidate.sections[0], target: ADO_FIELDS.reproSteps }
      const result = validateTemplate(candidate)
      expect(result.ok ? [] : result.reasons.map((reason) => [reason.code, reason.sectionKey, reason.message])).toEqual(
        [
          [
            'unknown-target',
            'userStory',
            'Section "userStory": a PBI can be Published only into Description, Acceptance Criteria.',
          ],
        ],
      )
    })

    it("checks a Template Session's submission against the session's type: a Task has no Acceptance Criteria", () => {
      const { workItemType: _, ...submitted } = content()
      expect(codes(submitted, { workItemType: 'Task' })).toEqual(['unknown-target:acceptanceCriteria'])
    })

    it("refuses an Iteration Log published into a field the type's form hides, but accepts one it shows", () => {
      const bug = {
        ...content(),
        workItemType: 'Bug',
        sections: content().sections.map((section) => ({ ...section, target: ADO_FIELDS.reproSteps })),
      }
      expect(codes({ ...bug, iterationLogTarget: ADO_FIELDS.description })).toEqual(['unknown-iteration-log-target'])
      expect(codes({ ...bug, iterationLogTarget: ADO_FIELDS.reproSteps })).toEqual([])
    })

    it('refuses a Template whose Work Item Type is missing or unknown, once rather than per Section', () => {
      const { workItemType: _, ...untyped } = content()
      expect(codes(untyped)).toEqual(['unknown-work-item-type'])
      expect(codes({ ...untyped, workItemType: 'Story' })).toEqual(['unknown-work-item-type'])
    })
  })

  describe('fields per Tracker', () => {
    /** The Default PBI Template's content as a Jira Story, every Section in Description. */
    const story = (): TemplateContent => ({
      ...content(),
      tracker: 'jira',
      workItemType: 'Story',
      sections: content().sections.map((section) => ({ ...section, target: JIRA_FIELDS.description })),
    })

    it('accepts a Jira Story written into Description', () => {
      expect(codes(story())).toEqual([])
    })

    it("refuses an Azure DevOps field in a Jira Template, naming Jira's fields", () => {
      const candidate = story()
      candidate.sections[0] = { ...candidate.sections[0], target: ADO_FIELDS.description }
      const result = validateTemplate(candidate)
      expect(result.ok ? [] : result.reasons.map((reason) => reason.message)).toEqual([
        'Section "userStory": a Jira Story can be copied only into Description, or a Custom Field.',
      ])
    })

    it("refuses a type the Template's Tracker does not define", () => {
      expect(codes({ ...story(), workItemType: 'PBI' })).toEqual(['unknown-work-item-type'])
      expect(codes({ ...content(), workItemType: 'Sub-task' })).toEqual(['unknown-work-item-type'])
    })

    it('refuses an unknown Tracker', () => {
      expect(codes({ ...story(), tracker: 'linear' as never })).toEqual(['unknown-tracker'])
    })

    it('accepts a named Custom Field in a Jira Template, also for the Iteration Log', () => {
      const candidate = story()
      const acField = customFieldTarget('Acceptance Criteria')
      candidate.sections = candidate.sections.map((section) =>
        section.key === 'acceptanceCriteria' ? { ...section, target: acField } : section,
      )
      expect(codes({ ...candidate, iterationLogTarget: acField })).toEqual([])
    })

    it('refuses a Custom Field without a name, or named like a system field', () => {
      const candidate = story()
      candidate.sections[0] = { ...candidate.sections[0], target: customFieldTarget('  ') }
      candidate.sections[1] = { ...candidate.sections[1], target: customFieldTarget('environment') }
      expect(codes(candidate)).toEqual(['bad-custom-field:userStory', 'bad-custom-field:roles'])
    })

    it('refuses a Custom Field in an Azure DevOps Template', () => {
      const candidate = content()
      candidate.sections[0] = { ...candidate.sections[0], target: customFieldTarget('Acceptance Criteria') }
      expect(codes(candidate)).toEqual(['unknown-target:userStory'])
    })

    it("checks a Template Session's submission against the session's Tracker", () => {
      const { workItemType: _, tracker: _tracker, ...submitted } = story()
      expect(codes(submitted, { tracker: 'jira', workItemType: 'Story' })).toEqual([])
      expect(codes(submitted, { workItemType: 'PBI' })).toHaveLength(content().sections.length)
    })
  })

  it('refuses input that is not a Template at all instead of crashing', () => {
    for (const junk of [
      null,
      'x',
      { name: 'x', sections: 'nope', method: 'm' },
      { name: 'x', sections: [3], method: 'm' },
    ])
      expect(codes(junk)).toEqual(['malformed-template'])
  })

  describe('method skeleton', () => {
    const skeletonMethod = `# Spike PBI Guide

## Purpose
A Spike PBI timeboxes an investigation. Developers read it before starting; the PO reads its outcome.

## Guiding principle
- Every Spike ends in a recommendation, not in code.

## Sections
### Question
The one question the Spike answers.
Good example: "Can the bulk endpoint handle 5,000 devices per request?"
Bad example: "Investigate bulk archive."

## Working process
1. Grill until the question and the timebox are clear.`

    it('is not required for hand-made or imported Templates', () => {
      expect(validateTemplate(content())).toEqual({ ok: true })
    })

    it('is required for Template Session output: Purpose, Guiding principle, Sections and Working process', () => {
      expect(codes(content(), { requireSkeleton: true })).toEqual(['method-missing-part'])
      const result = validateTemplate(content(), { requireSkeleton: true })
      expect(!result.ok && result.reasons[0].message).toContain('Purpose')
      expect(validateTemplate({ ...content(), method: skeletonMethod }, { requireSkeleton: true })).toEqual({
        ok: true,
      })
    })

    it('requires at least one good example in the method', () => {
      const noExamples = skeletonMethod.replace(/^(Good|Bad) example.*$/gm, '')
      expect(codes({ ...content(), method: noExamples }, { requireSkeleton: true })).toEqual([
        'method-without-examples',
      ])
    })

    it('is offered pre-filled for a Template built from nothing, where it passes the heading check', () => {
      const method = methodSkeleton('Spike PBI')
      for (const heading of ['Purpose', 'Guiding principle', 'Sections', 'Working process'])
        expect(method).toContain(`## ${heading}`)
    })
  })
})
