import { describe, expect, it } from 'vitest'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { applyImport, exportBundle, previewImport } from '#core/template/templateBundle.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { defaultBugTemplate, defaultPbiTemplate } from '#core/testing/fixtures.ts'

const backendPbi: Template = {
  ...defaultPbiTemplate,
  id: 't-backend',
  name: 'Backend PBI',
  isDefault: false,
  method: 'Write for backend devs.',
}
const spike: Template = {
  ...defaultPbiTemplate,
  id: 't-spike',
  name: 'Spike PBI',
  isDefault: false,
  method: 'Timebox it.',
}

describe('Template bundles', () => {
  it('marks each Template new, changed or identical by meaning, selecting only new ones', () => {
    const mine = [defaultPbiTemplate, backendPbi]
    const theirs = [
      { ...backendPbi, version: 7, updatedAt: '2030-01-01', method: '  Write for backend devs.\n' }, // same meaning
      { ...defaultPbiTemplate, method: defaultPbiTemplate.method + '\nAlso: be brief.' }, // changed
      spike, // new
    ]
    const preview = previewImport(exportBundle(theirs, '2026-09-22'), mine)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.items.map((i) => [i.template.name, i.status, i.selected])).toEqual([
      ['Backend PBI', 'identical', false],
      ['Default PBI Template', 'changed', false],
      ['Spike PBI', 'new', true],
    ])
  })

  it('carries where a Template puts its Iteration Log, and counts moving it as a change', () => {
    const teamBug: Template = { ...defaultBugTemplate, id: 't-bug', name: 'Team Bug', isDefault: false }
    const moved = { ...teamBug, iterationLogTarget: ADO_FIELDS.systemInfo }
    const preview = previewImport(exportBundle([moved], 'now'), [teamBug])
    expect(preview.ok && preview.items[0]).toMatchObject({
      status: 'changed',
      template: { iterationLogTarget: ADO_FIELDS.systemInfo },
    })
  })

  it('matches a colleague’s Template by type and name when its id differs', () => {
    const preview = previewImport(
      exportBundle([{ ...backendPbi, id: 't-other-machine', method: 'Different.' }], 'now'),
      [backendPbi],
    )
    expect(preview.ok && preview.items[0]).toMatchObject({ status: 'changed', matchId: 't-backend' })
  })

  it('never deletes: Templates missing from the bundle stay, and a changed Default arrives as a copy', () => {
    const mine = [defaultPbiTemplate, backendPbi]
    const bundle = exportBundle([{ ...defaultPbiTemplate, method: 'Changed default' }, spike], 'now')
    const preview = previewImport(bundle, mine)
    if (!preview.ok) throw new Error('preview failed')
    const writes = applyImport(
      mine,
      preview.items.map((i) => ({ ...i, selected: true })),
      '2026-09-22',
    )
    expect(writes.map((t) => t.name).sort()).toEqual(['Default PBI Template (imported)', 'Spike PBI'])
    expect(writes.every((t) => !t.isDefault)).toBe(true)
    expect(writes.some((t) => t.id === defaultPbiTemplate.id)).toBe(false)
  })

  it('overwrites a changed Template of mine only when selected, as its next version', () => {
    const preview = previewImport(exportBundle([{ ...backendPbi, method: 'Newer.' }], 'now'), [backendPbi])
    if (!preview.ok) throw new Error('preview failed')
    expect(applyImport([backendPbi], preview.items, 'now')).toEqual([])
    const [write] = applyImport(
      [backendPbi],
      preview.items.map((i) => ({ ...i, selected: true })),
      '2026-09-22',
    )
    expect(write).toMatchObject({ id: 't-backend', method: 'Newer.', version: backendPbi.version + 1 })
  })

  it('carries Templates only, and refuses files that are not bundles', () => {
    const bundle = exportBundle([{ ...spike, secret: 'draft content' } as Template], 'now')
    expect(JSON.stringify(bundle)).not.toContain('draft content')
    expect(Object.keys(bundle)).toEqual(['format', 'formatVersion', 'exportedAt', 'templates'])
    expect(previewImport({ projects: [] }, []).ok).toBe(false)
    expect(previewImport({ ...bundle, templates: [{ name: 'broken' }] }, []).ok).toBe(false)
  })

  it('leaves out where a Template was made — the Transcript link is local only', () => {
    const made = { ...spike, origin: { sessionId: 'sess-abc', at: '2026-09-22' } }
    const bundle = exportBundle([made], 'now')
    expect(JSON.stringify(bundle)).not.toContain('sess-abc')
    expect(bundle.templates[0]).not.toHaveProperty('origin')
  })
})
