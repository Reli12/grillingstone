import { describe, expect, it } from 'vitest'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { render } from '#core/publish/publishRenderer.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
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
    const d = out.fields[ADO_FIELDS.description]
    expect(d.indexOf('Technical Notes')).toBeLessThan(d.indexOf('User Story'))
    const a = out.fields[ADO_FIELDS.acceptanceCriteria]
    expect(a.indexOf('AC02')).toBeLessThan(a.indexOf('AC01'))
  })

  it('escapes the text people and Claude wrote', () => {
    let draft = v1Draft()
    draft = applyHumanOp(draft, { op: 'editSection', sectionId: sectionByKey(draft, 'technicalNotes').id, body: 'Use <script>alert(1)</script> & "quotes"' })
    draft = applyHumanOp(draft, { op: 'retitle', title: 'Archive <b>' })
    const out = render(draft)
    expect(out.fields[ADO_FIELDS.description]).toContain('Use &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;')
    expect(out.fields[ADO_FIELDS.description]).not.toContain('<script>')
    expect(out.title).toBe('Archive <b>')
  })

  it('renders Section headings, markdown tables and lists as rich-text HTML', () => {
    const d = render(v1Draft()).fields[ADO_FIELDS.description]
    expect(d).toContain('<h2>Roles</h2>')
    expect(d).toMatch(/<table>.*<th>Action<\/th>.*<td>Archive device<\/td>.*<\/table>/s)
  })

  it('appends the Iteration Log to the Description under the Template heading', () => {
    const d = render(v1Draft()).fields[ADO_FIELDS.description]
    expect(d.trimEnd()).toMatch(/<h2>PBI Iteration Log<\/h2>\s*<p>22\.09\.2026 - @dorijan v1<\/p>$/)
  })
})
