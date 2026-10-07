import { describe, expect, it } from 'vitest'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { methodSkeleton, type TemplateContent, validateTemplate } from '#core/template/templateValidator.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

const content = (): TemplateContent =>
  structuredClone({
    workItemType: defaultPbiTemplate.workItemType,
    name: defaultPbiTemplate.name,
    sections: defaultPbiTemplate.sections,
    method: defaultPbiTemplate.method,
  })
const codes = (c: unknown, opts?: Parameters<typeof validateTemplate>[1]) => {
  const r = validateTemplate(c, opts)
  return r.ok ? [] : r.reasons.map((x) => `${x.code}${x.sectionKey ? `:${x.sectionKey}` : ''}`)
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
    const c = content()
    c.sections[1] = { ...c.sections[1], key: 'user story' }
    c.sections[2] = { ...c.sections[2], key: 'userStory' }
    c.sections[3] = { ...c.sections[3], heading: '' }
    expect(codes(c)).toEqual(['bad-key:user story', 'duplicate-key:userStory', 'missing-heading:reusedPatterns'])
  })

  it('refuses unknown target fields and shapes, and Given/When/Then on prose', () => {
    const c = content()
    c.sections[0] = { ...c.sections[0], target: 'System.History' as never }
    c.sections[1] = { ...c.sections[1], shape: 'table' as never }
    c.sections[6] = { ...c.sections[6], entryFormat: 'gherkin' }
    expect(codes(c)).toEqual(['unknown-target:userStory', 'bad-shape:roles', 'gherkin-on-prose:technicalNotes'])
  })

  describe('fields per Work Item Type', () => {
    it('refuses a PBI Section published into Repro Steps, naming the fields a PBI may use', () => {
      const c = { ...content(), workItemType: 'PBI' }
      c.sections[0] = { ...c.sections[0], target: ADO_FIELDS.reproSteps }
      const r = validateTemplate(c)
      expect(r.ok ? [] : r.reasons.map((x) => [x.code, x.sectionKey, x.message])).toEqual([
        [
          'unknown-target',
          'userStory',
          'Section "userStory": a PBI can be Published only into Description, Acceptance Criteria.',
        ],
      ])
    })

    it("checks a Template Session's submission against the session's type: a Task has no Acceptance Criteria", () => {
      const { workItemType: _, ...submitted } = content()
      expect(codes(submitted, { workItemType: 'Task' })).toEqual(['unknown-target:acceptanceCriteria'])
    })

    it("refuses an Iteration Log published into a field the type's form hides, but accepts one it shows", () => {
      const bug = {
        ...content(),
        workItemType: 'Bug',
        sections: content().sections.map((s) => ({ ...s, target: ADO_FIELDS.reproSteps })),
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
      const r = validateTemplate(content(), { requireSkeleton: true })
      expect(!r.ok && r.reasons[0].message).toContain('Purpose')
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
      const m = methodSkeleton('Spike PBI')
      for (const h of ['Purpose', 'Guiding principle', 'Sections', 'Working process']) expect(m).toContain(`## ${h}`)
    })
  })
})
