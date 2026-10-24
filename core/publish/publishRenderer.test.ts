// Tests for the exact field values a Draft is copied or Published as, for each Tracker and format.
import { describe, expect, it } from 'vitest'

import type { Draft } from '#core/draft/draftTypes.ts'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { render } from '#core/publish/publishRenderer.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { customFieldTarget, JIRA_FIELDS, type SectionTarget } from '#core/shared/trackerFields.ts'
import { sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

describe('Publish Renderer', () => {
  it('renders the Title on its own and puts Acceptance Criteria only in their field', () => {
    const out = render(v1Draft())
    expect(out.title).toBe('Archive device from device list')
    expect(out.fields[ADO_FIELDS.acceptanceCriteria]).toContain('AC01 - Archive single device')
    expect(out.fields[ADO_FIELDS.description]).not.toContain('AC01')
    expect(out.fields[ADO_FIELDS.description]).toContain('As a Manager, I want to archive a device')
  })

  it('never includes Discarded Sections or Entries', () => {
    let draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    draft = applyHumanOp(draft, { op: 'discardSection', sectionId: sectionByKey(draft, 'design').id })
    draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
    const html = render(draft).fields[ADO_FIELDS.description]
    expect(html).not.toContain('Design')
    expect(html).not.toContain('notify the site owner')
    expect(html).toContain('keep sending telemetry')
  })

  it('keeps the human order of Sections and Entries', () => {
    let draft = v1Draft()
    draft = applyHumanOp(draft, { op: 'moveSection', sectionId: sectionByKey(draft, 'technicalNotes').id, toIndex: 0 })
    const ac = sectionByKey(draft, 'acceptanceCriteria')
    draft = applyHumanOp(draft, { op: 'moveEntry', sectionId: ac.id, entryId: ac.entries[1].id, toIndex: 0 })
    const out = render(draft)
    const description = out.fields[ADO_FIELDS.description]
    expect(description.indexOf('Technical Notes')).toBeLessThan(description.indexOf('User Story'))
    const acceptanceCriteria = out.fields[ADO_FIELDS.acceptanceCriteria]
    expect(acceptanceCriteria.indexOf('AC02')).toBeLessThan(acceptanceCriteria.indexOf('AC01'))
  })

  it('escapes the text people and Claude wrote', () => {
    let draft = v1Draft()
    draft = applyHumanOp(draft, {
      op: 'editSection',
      sectionId: sectionByKey(draft, 'technicalNotes').id,
      body: 'Use <script>alert(1)</script> & "quotes"',
    })
    draft = applyHumanOp(draft, { op: 'retitle', title: 'Archive <b>' })
    const out = render(draft)
    expect(out.fields[ADO_FIELDS.description]).toContain(
      'Use &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;',
    )
    expect(out.fields[ADO_FIELDS.description]).not.toContain('<script>')
    expect(out.title).toBe('Archive <b>')
  })

  it('renders Section headings, markdown tables and lists as rich-text HTML', () => {
    const description = render(v1Draft()).fields[ADO_FIELDS.description]
    expect(description).toContain('<h2>Roles</h2>')
    expect(description).toMatch(/<table>.*<th>Action<\/th>.*<td>Archive device<\/td>.*<\/table>/s)
  })

  it('appends the Iteration Log to the Description under the Template heading', () => {
    const description = render(v1Draft()).fields[ADO_FIELDS.description]
    expect(description.trimEnd()).toMatch(/<h2>PBI Iteration Log<\/h2>\s*<p>22\.09\.2026 - @dorijan v1<\/p>$/)
  })

  describe('a Bug', () => {
    /** The fixture Draft, published the way a Bug is: everything but Acceptance Criteria into Repro Steps. */
    const bugDraft = (iterationLogTarget?: SectionTarget): Draft => {
      const draft = v1Draft()
      const toReproSteps = <T extends { target: SectionTarget }>(section: T) =>
        section.target === ADO_FIELDS.description ? { ...section, target: ADO_FIELDS.reproSteps } : section
      return {
        ...draft,
        workItemType: 'Bug',
        sections: draft.sections.map(toReproSteps),
        template: {
          ...draft.template,
          workItemType: 'Bug',
          sections: draft.template.sections.map(toReproSteps),
          ...(iterationLogTarget ? { iterationLogTarget } : {}),
        },
      }
    }

    it('fills Repro Steps with headed Sections and offers no Description', () => {
      const out = render(bugDraft(ADO_FIELDS.reproSteps))
      expect(out.fields[ADO_FIELDS.reproSteps]).toContain('<h2>User Story</h2>')
      expect(out.fields).not.toHaveProperty(ADO_FIELDS.description)
    })

    it('appends the Iteration Log to the field the Template names', () => {
      const reproSteps = render(bugDraft(ADO_FIELDS.reproSteps)).fields[ADO_FIELDS.reproSteps]
      expect(reproSteps.trimEnd()).toMatch(/<h2>PBI Iteration Log<\/h2>\s*<p>22\.09\.2026 - @dorijan v1<\/p>$/)
    })

    it('appends the Iteration Log to Repro Steps when its Template names no field', () => {
      const out = render(bugDraft())
      expect(out.fields[ADO_FIELDS.reproSteps]).toContain('PBI Iteration Log')
      expect(out.fields).not.toHaveProperty(ADO_FIELDS.description)
    })
  })

  describe('a Jira Draft', () => {
    /** The fixture Draft as a Jira Story: every Section in Description unless `targets` says otherwise. */
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

    it('puts Acceptance Criteria into the Description under their own heading', () => {
      const out = render(jiraDraft())
      expect(Object.keys(out.fields)).toEqual([JIRA_FIELDS.description])
      expect(out.fields[JIRA_FIELDS.description]).toMatch(
        /<h2>Acceptance Criteria<\/h2>\s*<p><strong>AC01 - Archive single device/,
      )
    })

    it('appends the Iteration Log to the Description', () => {
      const description = render(jiraDraft()).fields[JIRA_FIELDS.description]
      expect(description.trimEnd()).toMatch(/<h2>PBI Iteration Log<\/h2>\s*<p>22\.09\.2026 - @dorijan v1<\/p>$/)
    })

    it('gives a Custom Field its own field, named by the field rather than a heading', () => {
      const acField = customFieldTarget('Acceptance Criteria')
      const out = render(jiraDraft({ acceptanceCriteria: acField }))
      expect(out.fields[acField]).toMatch(/^<p><strong>AC01 - Archive single device/)
      expect(out.fields[JIRA_FIELDS.description]).not.toContain('AC01')
    })

    it('renders wiki markup on request', () => {
      const description = render(jiraDraft(), 'jira-wiki').fields[JIRA_FIELDS.description]
      expect(description).toMatch(/^h2\. User Story\nAs a Manager, I want to archive a device/)
      expect(description).toContain('||Action||Admin||Manager||Technician||')
      expect(description).toMatch(/\*AC01 - Archive single device[^*]*\*\n\*Given\* /)
      expect(description.trimEnd()).toMatch(/h2\. PBI Iteration Log\n22\.09\.2026 - @dorijan v1$/)
      expect(description).not.toContain('<')
    })
  })
})
