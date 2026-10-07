// Tests for the seed a Grilling Session starts from: Template, Draft, Glossary, References and Discarded content.
import { describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { buildSeed } from '#core/session/grillingSeed.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { defaultBugTemplate, defaultPbiTemplate, meta, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

const submitCommand = 'node "/tool/scripts/writeDraft.mjs"'

describe('Session Seed Builder', () => {
  it('gives a first session the Template method, its Sections and the requirement', () => {
    const draft = newDraft({
      projectId: 'customer-portal',
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'Managers need to archive devices.',
      now: meta.date,
    })
    const seed = buildSeed({
      kind: 'first',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
    })
    const all = seed.systemPrompt + seed.firstMessage
    expect(all).toContain('Frontend PBI Guide')
    expect(all).toContain('Managers need to archive devices.')
    expect(all).toContain('acceptanceCriteria')
  })

  it('grills a Bug as an observed defect, never recommending what the human saw or did', () => {
    const draft = newDraft({
      projectId: 'customer-portal',
      workItemType: 'Bug',
      template: defaultBugTemplate,
      requirement: 'Blank page after paying.',
      now: meta.date,
    })
    const seed = buildSeed({
      kind: 'first',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
    })
    const all = seed.systemPrompt + seed.firstMessage
    expect(all).toContain('a requirement or an observed defect')
    expect(all).toMatch(/observed facts .* without a recommended answer/i)
    expect(all).toContain('Bug Guide')
    expect(all).not.toContain('described the requirement')
  })

  it('gives a later session the current Draft with ids, and asks for a Proposal instead of a rewrite', () => {
    const draft = v1Draft()
    const seed = buildSeed({
      kind: 'iteration',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
    })
    const all = seed.systemPrompt + seed.firstMessage
    const ac = sectionByKey(draft, 'acceptanceCriteria')
    expect(all).toContain(ac.id)
    expect(all).toContain(ac.entries[0].id)
    expect(all).toContain('AC01 - Archive single device')
    expect(all).toMatch(/Proposal/)
    expect(all).toContain('replaceEntry')
  })

  it('passes the Project Glossary and the References as context', () => {
    const glossary =
      '# Customer Portal\n\n## Language\n\n**Archived Device**:\nHidden from dashboards, still billed.\n_Avoid_: deleted\n'
    const seed = buildSeed({
      kind: 'iteration',
      draft: v1Draft(),
      projectName: 'Customer Portal',
      glossary,
      references: [
        {
          title: 'Restore archived device',
          workItemType: 'PBI',
          markdown: '# Restore archived device\nOnly Admins restore.',
        },
      ],
      submitCommand,
    })
    const all = seed.systemPrompt + seed.firstMessage
    expect(all).toContain('Hidden from dashboards, still billed.')
    expect(all).toContain('Restore archived device')
    expect(all).toContain('Only Admins restore.')
  })

  it('lists what the human Discarded as judgements not to re-propose, apart from the live content', () => {
    let draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
    draft = applyHumanOp(draft, { op: 'discardSection', sectionId: sectionByKey(draft, 'design').id })
    const all = Object.values(
      buildSeed({
        kind: 'iteration',
        draft,
        projectName: 'Customer Portal',
        glossary: '',
        references: [],
        submitCommand,
      }),
    ).join('\n')
    const discardedPart = all.slice(all.indexOf('Discarded by the human'))
    expect(discardedPart).toContain('Should archiving notify the site owner?')
    expect(discardedPart).toContain('Design')
    expect(all.indexOf('notify the site owner')).toBeGreaterThan(all.indexOf('Discarded by the human'))
  })

  it('names the focus of a Focused Session', () => {
    const draft = v1Draft()
    const scope = sectionByKey(draft, 'scope')
    const seed = buildSeed({
      kind: 'focused',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
      focus: { sectionId: scope.id },
      humanNote: 'BA wants bulk archive back in',
    })
    expect(seed.firstMessage).toContain('Focused Session on "Scope"')
    expect(seed.firstMessage).toContain(scope.id)
    expect(seed.firstMessage).toContain('BA wants bulk archive back in')
  })

  it('tells a Template upgrade which Sections the newer version adds', () => {
    const upgradeTo: Template = {
      ...defaultPbiTemplate,
      version: 2,
      sections: [
        ...defaultPbiTemplate.sections,
        {
          key: 'analytics',
          heading: 'Analytics Events',
          shape: 'entries',
          locked: false,
          guidance: 'Tracking events',
          target: 'System.Description',
        },
      ],
    }
    const seed = buildSeed({
      kind: 'upgrade',
      draft: v1Draft(),
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
      upgradeTo,
    })
    expect(seed.firstMessage).toContain('Analytics Events')
    expect(seed.firstMessage).toContain('addSection')
  })

  it('carries no chat from earlier sessions — only the Draft, Glossary and References', () => {
    const seed = buildSeed({
      kind: 'iteration',
      draft: v1Draft(),
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
    })
    expect(seed.systemPrompt + seed.firstMessage).not.toMatch(/transcript|previous conversation/i)
  })

  it('passes on what the human said when they restart the first session by typing', () => {
    const draft = newDraft({
      projectId: 'customer-portal',
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'Export invoices as PDF.',
      now: meta.date,
    })
    const seed = buildSeed({
      kind: 'first',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
      humanNote: 'Only Account Admins may export.',
    })
    expect(seed.firstMessage).toContain('Only Account Admins may export.')
    expect(seed.firstMessage).toContain('Export invoices as PDF.')
  })

  it('tells a Continuation that the current Draft wins over the conversation it resumes', () => {
    const draft = v1Draft()
    const seed = buildSeed({
      kind: 'iteration',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
      humanNote: 'Bulk archive is back',
      continuing: true,
    })
    expect(seed.firstMessage).toContain('continues your earlier conversation')
    expect(seed.firstMessage).toContain(sectionByKey(draft, 'scope').id)
    expect(seed.firstMessage).toContain('Bulk archive is back')
    expect(seed.firstMessage).toMatch(/Proposal against the current Draft \(v1\)/)
    expect(seed.firstMessage).not.toContain('Start with your first question')
  })

  it('keeps a Continuation before v1 on writing v1', () => {
    const draft = newDraft({
      projectId: 'customer-portal',
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'Export invoices as PDF.',
      now: meta.date,
    })
    const seed = buildSeed({
      kind: 'first',
      draft,
      projectName: 'Customer Portal',
      glossary: '',
      references: [],
      submitCommand,
      continuing: true,
    })
    expect(seed.firstMessage).toContain('continues your earlier conversation')
    expect(seed.firstMessage).toContain('Nothing has been written yet')
    expect(seed.systemPrompt).toContain('writes Draft v1 directly')
  })
})
