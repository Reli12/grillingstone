// Tests for the Publish Plan: every reason Publish is blocked, create vs update, the parent rule per type, area,
// tags, and which Azure DevOps changes an update writes over.
import { describe, expect, it } from 'vitest'

import type { WorkItemView } from '#core/ado/adoTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { copyFields } from '#core/publish/copyFields.ts'
import { publishedSnapshot } from '#core/publish/publishedSnapshot.ts'
import { cleanTags, type PublishInput, publishOperations, publishPlan } from '#core/publish/publishPlan.ts'
import { render } from '#core/publish/publishRenderer.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

const ORG = 'https://dev.azure.com/abysalto'

/** The item as Azure DevOps would hold it after Publishing `draft`. */
export function itemOf(draft: Draft, overrides: Partial<WorkItemView> = {}): WorkItemView {
  const rendered = render(draft)
  return {
    id: 501,
    rev: 3,
    adoType: 'Product Backlog Item',
    workItemType: draft.workItemType,
    title: rendered.title,
    fields: rendered.fields,
    parentId: null,
    teamProject: 'Customer Portal',
    areaPath: 'Customer Portal',
    iterationPath: 'Customer Portal',
    state: 'New',
    tags: [],
    url: `${ORG}/Customer%20Portal/_workitems/edit/501`,
    ...overrides,
  }
}

const feature = (overrides: Partial<WorkItemView> = {}): WorkItemView => ({
  ...itemOf(v1Draft()),
  id: 100,
  adoType: 'Feature',
  workItemType: 'Feature',
  title: 'Device archiving',
  areaPath: 'Customer Portal\\Devices',
  ...overrides,
})

const input = (overrides: Partial<PublishInput> = {}): PublishInput => ({
  draft: v1Draft(),
  connection: 'connected',
  backlog: 'Customer Portal',
  tags: ['frontend'],
  linked: null,
  parent: { workItemId: 100, item: feature() },
  ...overrides,
})

/** The Draft after a Publish of it to `item`. */
const published = (draft: Draft, item = itemOf(draft)): Draft => ({
  ...draft,
  linkedWorkItem: { id: item.id, url: item.url, workItemType: draft.workItemType },
  publishedSnapshot: publishedSnapshot(draft, item, '2026-11-01'),
})

const codes = (plan: ReturnType<typeof publishPlan>) => (plan.ok ? [] : plan.reasons.map((reason) => reason.code))

describe('Publish Plan', () => {
  it('creates a PBI under its Parent, in its Parent’s area, with the dialog’s tags and the Copy fields', () => {
    const plan = publishPlan(input({ tags: [' frontend ', 'FRONTEND', 'sems;ui'] }))
    expect(plan).toMatchObject({
      ok: true,
      mode: 'create',
      adoType: 'Product Backlog Item',
      addParent: 100,
      areaPath: 'Customer Portal\\Devices',
      iterationPath: 'Customer Portal',
      tags: ['frontend', 'sems', 'ui'],
    })
    const fields = plan.ok ? plan.fields.map((field) => [field.field, field.value]) : []
    const copied = copyFields(v1Draft()).fields.map((field) => [field.field, field.html ?? field.text])
    expect(fields).toEqual(copied)
  })

  it('puts an item whose parent lives in another Azure DevOps project at the Backlog’s root', () => {
    const plan = publishPlan(input({ parent: { workItemId: 100, item: feature({ teamProject: 'Billing' }) } }))
    expect(plan).toMatchObject({ ok: true, areaPath: 'Customer Portal', addParent: 100 })
  })

  it.each([
    [{ connection: 'none' as const }, 'connection'],
    [{ connection: 'rejected' as const }, 'rejected'],
    [{ backlog: undefined }, 'backlog'],
    [{ draft: { ...v1Draft(), archived: true } }, 'archived'],
    [{ draft: { ...v1Draft(), version: 0 } }, 'notWritten'],
    [{ parent: null }, 'parentMissing'],
    [{ parent: { workItemId: 77, item: null } }, 'parentNotFound'],
    [{ parent: null, parentError: 'Not a work item.' }, 'parentInvalid'],
  ])('is blocked by %o', (overrides, code) => {
    expect(codes(publishPlan(input(overrides)))).toContain(code)
  })

  it('blocks while changes brought in from Azure DevOps wait for triage', () => {
    const draft: Draft = {
      ...v1Draft(),
      proposal: {
        id: 'p-1',
        sessionId: 'drift-1',
        kind: 'drift',
        createdAt: '2026-11-02',
        changes: [{ id: 'c-1', kind: 'retitle', label: 'Title', after: 'x', conflict: false, status: 'pending' }],
      },
    }
    expect(codes(publishPlan(input({ draft })))).toEqual(['drift'])
  })

  it('applies the parent rule per type: an Epic never, a Bug optionally, a Task always', () => {
    const typed = (workItemType: Draft['workItemType']) => ({ ...v1Draft(), workItemType })
    expect(publishPlan(input({ draft: typed('Epic') }))).toMatchObject({ ok: true, addParent: null })
    expect(publishPlan(input({ draft: typed('Bug'), parent: null }))).toMatchObject({ ok: true, addParent: null })
    expect(codes(publishPlan(input({ draft: typed('Task'), parent: null })))).toEqual(['parentMissing'])
  })

  it('updates only what changed, and counts a parent the item already has', () => {
    let draft = published(v1Draft())
    const item = itemOf(draft, { parentId: 100 })
    draft = applyHumanOp(draft, { op: 'retitle', title: 'Archive a device' })
    const plan = publishPlan(input({ draft, linked: item, parent: null }))
    expect(plan).toMatchObject({ ok: true, mode: 'update', workItemId: 501, expectedRev: 3, addParent: null })
    expect(plan.ok && plan.fields).toEqual([
      { field: ADO_FIELDS.title, label: 'Title', value: 'Archive a device', before: 'Archive device from device list' },
    ])
    expect(plan.ok && plan.mode === 'update' && plan.overwrites).toEqual([])
  })

  it('adds the Draft’s Parent to a linked item without one, but never replaces a parent', () => {
    const draft = published(v1Draft())
    expect(publishPlan(input({ draft, linked: itemOf(draft) }))).toMatchObject({ ok: true, addParent: 100 })
    expect(publishPlan(input({ draft, linked: itemOf(draft, { parentId: 9 }) }))).toMatchObject({ addParent: null })
  })

  it('names the Azure DevOps changes an update writes over', () => {
    const draft = published(v1Draft())
    const changedInAdo = itemOf(draft, { rev: 5, title: 'Renamed by the PO' })
    const plan = publishPlan(input({ draft, linked: changedInAdo }))
    expect(plan).toMatchObject({ ok: true, overwrites: ['Title'] })
  })

  it('ignores Azure DevOps reformatting its HTML', () => {
    const draft = published(v1Draft())
    const description = render(draft)
      .fields[ADO_FIELDS.description].replaceAll('<p>', '<div>')
      .replaceAll('</p>', '</div>')
    const item = itemOf(draft, { fields: { ...itemOf(draft).fields, [ADO_FIELDS.description]: description } })
    const plan = publishPlan(input({ draft, linked: item }))
    expect(plan.ok && plan.fields).toEqual([])
  })

  it('refuses a linked item that is gone or of another type', () => {
    const draft = published(v1Draft())
    expect(codes(publishPlan(input({ draft, linked: null })))).toContain('linkedNotFound')
    const bug = itemOf(draft, { workItemType: 'Bug', adoType: 'Bug' })
    expect(codes(publishPlan(input({ draft, linked: bug })))).toContain('type')
  })

  it('turns a plan into Azure DevOps JSON Patch: fields, area, tags and parent; a rev test for an update', () => {
    const create = publishPlan(input())
    if (!create.ok) throw new Error('expected a plan')
    const ops = publishOperations(create, ORG)
    expect(ops).toContainEqual({ op: 'add', path: '/fields/System.AreaPath', value: 'Customer Portal\\Devices' })
    expect(ops).toContainEqual({ op: 'add', path: '/fields/System.Tags', value: 'frontend' })
    expect(ops.at(-1)).toEqual({
      op: 'add',
      path: '/relations/-',
      value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${ORG}/_apis/wit/workItems/100` },
    })
    const before = published(v1Draft())
    const draft = applyHumanOp(before, { op: 'retitle', title: 'New' })
    const update = publishPlan(input({ draft, linked: itemOf(before, { parentId: 1 }) }))
    if (!update.ok) throw new Error('expected a plan')
    expect(publishOperations(update, ORG)).toEqual([
      { op: 'test', path: '/rev', value: 3 },
      { op: 'add', path: '/fields/System.Title', value: 'New' },
    ])
  })

  it('cleans tags', () => {
    expect(cleanTags(['a', ' A ', '', 'b; c'])).toEqual(['a', 'b', 'c'])
  })

  it('leaves the snapshot of a section-level edit as the baseline', () => {
    const draft = published(v1Draft())
    const scope = sectionByKey(draft, 'scope')
    expect(draft.publishedSnapshot?.draft.sections.find((section) => section.id === scope.id)?.entries).toHaveLength(2)
  })
})
