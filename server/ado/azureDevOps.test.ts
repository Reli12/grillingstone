// Tests of the Azure DevOps Connection over the HTTP API, against an in-memory Azure DevOps faked at the HTTP
// boundary: Connection (401 handling, rejected state), Backlog and Default Tags, Publish (create, update, snapshot,
// revision guard, Drift first, to an existing item), Import refusals, Refresh through the re-paste path, and revision
// checks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RevisionCheck } from '#core/contract/apiTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { PublishPlan } from '#core/publish/publishPlan.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { defaultPbiTemplate, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

import { FakeAzureDevOps, GOOD_TOKEN, MemorySecretStore, ORG_URL } from '../../test/server/fakeAzureDevOps.ts'
import { startBackend } from '../../test/server/testBackend.ts'
import { createDraft, getDraft } from '../storage/drafts.ts'

let ado: FakeAzureDevOps
let store: MemorySecretStore
let backend: Awaited<ReturnType<typeof startBackend>>
const call = (...args: Parameters<typeof backend.call>) => backend.call(...args)

beforeEach(async () => {
  ado = new FakeAzureDevOps()
  store = new MemorySecretStore()
  backend = await startBackend({ fetch: ado.fetch, store })
})
afterEach(() => backend.close())

const connect = () => call('PUT', '/api/connection', { orgUrl: ORG_URL, token: GOOD_TOKEN })

async function adoProject(backlog?: string) {
  const project = (await call('POST', '/api/projects', { name: 'Fleet', tracker: 'azure-devops' })).body as {
    id: string
  }
  if (backlog) {
    await connect()
    expect((await call('PUT', `/api/projects/${project.id}/backlog`, { name: backlog })).status).toBe(200)
  }
  return project.id
}

let drafts = 0

/** A written PBI Draft in the Project, saved directly (no session needed). */
async function writtenPbi(projectId: string): Promise<Draft> {
  drafts += 1
  return createDraft({ ...v1Draft(), id: `d-test-${drafts}`, projectId, lane: 'review' })
}

/** The Feature #100 in the Backlog, pasted as a Backlog Copy and marked as the Draft's Parent. */
async function withParent(projectId: string, draftId: string) {
  ado.add({
    id: 100,
    project: 'Customer Portal',
    fields: {
      'System.WorkItemType': 'Feature',
      'System.Title': 'Device archiving',
      'System.AreaPath': 'Customer Portal\\Devices',
    },
  })
  await call('POST', `/api/projects/${projectId}/backlog-copies`, {
    workItem: '#100',
    workItemType: 'Feature',
    title: 'Device archiving',
    content: 'BR1',
  })
  await call('PATCH', `/api/projects/${projectId}/drafts/${draftId}/backlog-references`, {
    backlogReferences: ['ado-100'],
  })
  expect(
    (await call('PATCH', `/api/projects/${projectId}/drafts/${draftId}/parent`, { copyId: 'ado-100' })).status,
  ).toBe(200)
}

const plan = async (projectId: string, draftId: string, body = {}) =>
  (await call('POST', `/api/projects/${projectId}/drafts/${draftId}/publish/plan`, body)).body as {
    plan: PublishPlan
    defaultTags: string[]
    choosesTarget: boolean
  }

/** Publishes a Draft not linked yet to the existing item `existing`, as the dialog would after showing its plan. */
async function publishTo(projectId: string, draftId: string, existing: string) {
  const { plan: planned } = await plan(projectId, draftId, { existing })
  expect(planned).toMatchObject({ ok: true, mode: 'update' })
  const expectedRev = planned.ok && planned.mode === 'update' ? planned.expectedRev : null
  return call('POST', `/api/projects/${projectId}/drafts/${draftId}/publish`, { tags: [], expectedRev, existing })
}

describe('Connection', () => {
  it('saves nothing until Azure DevOps accepts the token, and never answers with it', async () => {
    expect((await call('GET', '/api/connection')).body).toMatchObject({ state: 'none' })
    const refused = await call('PUT', '/api/connection', { orgUrl: ORG_URL, token: 'typo' })
    expect(refused.status).toBe(422)
    expect(store.secrets).toBeNull()

    const saved = await connect()
    expect(saved.body).toMatchObject({
      state: 'connected',
      user: 'Dana Developer',
      organization: 'acme',
      orgUrl: ORG_URL,
    })
    expect(JSON.stringify(saved.body)).not.toContain(GOOD_TOKEN)
    expect(store.secrets).toEqual({ orgUrl: ORG_URL, token: GOOD_TOKEN })
  })

  it('shows the token as rejected after any 401, until it is replaced; Disconnect removes it', async () => {
    const projectId = await adoProject('Customer Portal')
    ado.token = 'rotated'
    const check = (await call('GET', `/api/projects/${projectId}/revisions`)).body as RevisionCheck
    expect(check.unavailable).toBeUndefined()
    await call('POST', `/api/projects/${projectId}/work-items/lookup`, { workItem: '1' })
    expect((await call('GET', '/api/connection')).body).toMatchObject({ state: 'rejected' })
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body).toMatchObject({
      unavailable: expect.stringContaining('rejected'),
    })

    ado.token = 'new-token'
    await call('PUT', '/api/connection', { orgUrl: ORG_URL, token: 'new-token' })
    expect((await call('GET', '/api/connection')).body).toMatchObject({ state: 'connected' })
    expect((await call('DELETE', '/api/connection')).body).toMatchObject({ state: 'none' })
    expect(store.secrets).toBeNull()
  })
})

describe('Backlog and Default Tags', () => {
  it('needs a Connection, then accepts only a Scrum project, in its own spelling, typed or from a link', async () => {
    const projectId = await adoProject()
    expect((await call('PUT', `/api/projects/${projectId}/backlog`, { name: 'Customer Portal' })).status).toBe(409)
    await connect()
    expect((await call('PUT', `/api/projects/${projectId}/backlog`, { name: 'Nope' })).body).toMatchObject({
      error: 'No Azure DevOps project "Nope" in acme. Check the spelling.',
    })
    expect((await call('PUT', `/api/projects/${projectId}/backlog`, { name: 'Legacy CRM' })).body.error).toContain(
      'Product Backlog Item',
    )
    const link = `${ORG_URL}/Customer%20Portal/_backlogs/backlog`
    expect((await call('PUT', `/api/projects/${projectId}/backlog`, { name: link })).body).toMatchObject({
      backlog: 'Customer Portal',
    })
    expect((await call('PUT', `/api/projects/${projectId}/backlog`, { name: 'billing' })).body.backlog).toBe('Billing')
  })

  it('fixes the Backlog once a Draft is linked, and cleans Default Tags', async () => {
    const projectId = await adoProject('Customer Portal')
    const draft = await writtenPbi(projectId)
    ado.add({
      id: 501,
      project: 'Customer Portal',
      parentId: 100,
      fields: { 'System.WorkItemType': 'Product Backlog Item' },
    })
    expect((await publishTo(projectId, draft.id, '501')).status).toBe(200)
    expect((await call('PUT', `/api/projects/${projectId}/backlog`, { name: 'Billing' })).status).toBe(422)
    expect((await call('DELETE', `/api/projects/${projectId}/backlog`)).status).toBe(422)
    const tags = await call('PUT', `/api/projects/${projectId}/default-tags`, { tags: [' sems ', 'SEMS', 'ui;web'] })
    expect(tags.body.defaultTags).toEqual(['sems', 'ui', 'web'])
  })
})

describe('Publish', () => {
  it('is blocked with every reason while the Project has no Backlog and the Draft no Parent', async () => {
    const projectId = await adoProject()
    const draft = await writtenPbi(projectId)
    const { plan: blocked } = await plan(projectId, draft.id)
    expect(blocked.ok ? [] : blocked.reasons.map((reason) => reason.code)).toEqual([
      'connection',
      'backlog',
      'parentMissing',
    ])
    expect(ado.calls).toEqual([])
  })

  it('creates the item under its Parent with the dialog’s tags, links the Draft and keeps the Published Snapshot', async () => {
    const projectId = await adoProject('Customer Portal')
    await call('PUT', `/api/projects/${projectId}/default-tags`, { tags: ['sems'] })
    const draft = await writtenPbi(projectId)
    await withParent(projectId, draft.id)

    const preview = await plan(projectId, draft.id)
    expect(preview.defaultTags).toEqual(['sems'])
    expect(preview.plan).toMatchObject({
      ok: true,
      mode: 'create',
      addParent: 100,
      areaPath: 'Customer Portal\\Devices',
    })

    const published = await call('POST', `/api/projects/${projectId}/drafts/${draft.id}/publish`, {
      tags: ['sems', 'frontend'],
      expectedRev: null,
    })
    expect(published.status).toBe(200)
    const created = ado.items.get(published.body.workItemId)!
    expect(created).toMatchObject({ parentId: 100, project: 'Customer Portal' })
    expect(created.fields).toMatchObject({
      'System.Title': 'Archive device from device list',
      'System.Tags': 'sems; frontend',
      'System.AreaPath': 'Customer Portal\\Devices',
      'System.IterationPath': 'Customer Portal',
    })
    const saved = await getDraft(projectId, draft.id)
    expect(saved.linkedWorkItem).toMatchObject({ id: created.id, workItemType: 'PBI' })
    expect(saved.publishedSnapshot).toMatchObject({ rev: created.rev, title: 'Archive device from device list' })
  })

  it('updates only what changed, refuses a stale confirmation, and brings Drift in before it overwrites anything', async () => {
    const projectId = await adoProject('Customer Portal')
    const draft = await writtenPbi(projectId)
    await withParent(projectId, draft.id)
    const first = await call('POST', `/api/projects/${projectId}/drafts/${draft.id}/publish`, {
      tags: [],
      expectedRev: null,
    })
    const id = first.body.workItemId as number
    const ops = `/api/projects/${projectId}/drafts/${draft.id}/ops`
    await call('POST', ops, { op: 'retitle', title: 'Archive a device' })

    const update = (await plan(projectId, draft.id)).plan
    expect(update).toMatchObject({ ok: true, mode: 'update', workItemId: id, overwrites: [] })
    expect(update.ok && update.fields.map((field) => field.label)).toEqual(['Title'])

    // The PO rewrites the User Story in Azure DevOps.
    const description = ado.items.get(id)!.fields[ADO_FIELDS.description] as string
    ado.edit(id, { [ADO_FIELDS.description]: description.replace('As a Manager', 'As an Admin') })
    const blocked = (await plan(projectId, draft.id)).plan
    expect(blocked.ok ? [] : blocked.reasons.map((reason) => reason.code)).toEqual(['drift'])
    const withDrift = await getDraft(projectId, draft.id)
    expect(withDrift.lane).toBe('needs')
    expect(withDrift.proposal).toMatchObject({ kind: 'drift', changes: [{ kind: 'replaceSection', conflict: false }] })

    // Declined: the next Publish writes the Draft's version back over it, and says so.
    const changeId = withDrift.proposal!.changes[0].id
    await call('POST', `/api/projects/${projectId}/drafts/${draft.id}/proposal/decide`, { changeId, accept: false })
    const overwriting = (await plan(projectId, draft.id)).plan
    expect(overwriting).toMatchObject({ ok: true, overwrites: ['Description'] })
    const rev = overwriting.ok && overwriting.mode === 'update' ? overwriting.expectedRev : -1

    const stale = await call('POST', `/api/projects/${projectId}/drafts/${draft.id}/publish`, {
      tags: [],
      expectedRev: rev - 1,
    })
    expect(stale.status).toBe(409)
    const done = await call('POST', `/api/projects/${projectId}/drafts/${draft.id}/publish`, {
      tags: [],
      expectedRev: rev,
    })
    expect(done.status).toBe(200)
    expect(ado.items.get(id)!.fields['System.Title']).toBe('Archive a device')
    expect(ado.items.get(id)!.fields[ADO_FIELDS.description]).toContain('As a Manager')
    const after = await getDraft(projectId, draft.id)
    expect(after.publishedSnapshot?.rev).toBe(ado.items.get(id)!.rev)
    expect(after.driftSeen).toBeUndefined()
    expect((await plan(projectId, draft.id)).plan).toMatchObject({ ok: true, fields: [] })
  })
})

describe('Publish to an existing item, and Import', () => {
  it('updates an existing item instead of creating one, keeps its parent and links the Draft', async () => {
    const projectId = await adoProject('Customer Portal')
    const draft = await writtenPbi(projectId)
    ado.add({
      id: 9,
      project: 'Customer Portal',
      parentId: 100,
      fields: { 'System.WorkItemType': 'Product Backlog Item', 'System.Title': 'Written by hand' },
    })
    const { plan: planned, choosesTarget } = await plan(projectId, draft.id, { existing: '#9' })
    expect(choosesTarget).toBe(true)
    expect(planned).toMatchObject({ ok: true, mode: 'update', workItemId: 9, parentId: 100, addParent: null })
    expect(planned.ok && planned.fields.find((field) => field.label === 'Title')).toMatchObject({
      before: 'Written by hand',
    })

    expect((await publishTo(projectId, draft.id, '#9')).status).toBe(200)
    expect(ado.items.get(9)!.fields['System.Title']).toBe('Archive device from device list')
    expect(ado.items.size).toBe(1)
    const saved = await getDraft(projectId, draft.id)
    expect(saved.linkedWorkItem).toMatchObject({ id: 9, workItemType: 'PBI' })
    expect(await plan(projectId, draft.id, { existing: '#555' })).toMatchObject({
      choosesTarget: false,
      plan: { ok: true, workItemId: 9 },
    })
  })

  it('refuses existing items outside the Backlog, of another type, or already linked to another Draft', async () => {
    const projectId = await adoProject('Customer Portal')
    const [one, two] = [await writtenPbi(projectId), await writtenPbi(projectId)]
    ado.add({ id: 7, project: 'Billing', fields: { 'System.WorkItemType': 'Product Backlog Item' } })
    ado.add({ id: 8, project: 'Customer Portal', fields: { 'System.WorkItemType': 'Bug' } })
    ado.add({
      id: 9,
      project: 'Customer Portal',
      parentId: 100,
      fields: { 'System.WorkItemType': 'Product Backlog Item' },
    })
    const refusal = async (draftId: string, existing: string) => {
      const { plan: planned } = await plan(projectId, draftId, { existing })
      return planned.ok ? '' : planned.reasons.find((reason) => reason.code === 'existingInvalid')?.message
    }

    expect(await refusal(one.id, '7')).toContain('Backlog Copy instead')
    expect(await refusal(one.id, '8')).toContain('is a Bug')
    expect(await refusal(one.id, '404')).toContain('does not exist')
    expect((await publishTo(projectId, one.id, `${ORG_URL}/Customer%20Portal/_workitems/edit/9`)).status).toBe(200)
    expect(await refusal(two.id, '9')).toContain('already linked')
    const refused = await call('POST', `/api/projects/${projectId}/drafts/${two.id}/publish`, {
      tags: [],
      expectedRev: 1,
      existing: '9',
    })
    expect(refused.status).toBe(422)
    expect(ado.calls.filter((made) => made.startsWith('PATCH'))).toHaveLength(1)
    expect(
      (await call('DELETE', `/api/projects/${projectId}/drafts/${one.id}/link`)).body.linkedWorkItem,
    ).toBeUndefined()
    expect((await publishTo(projectId, two.id, '9')).status).toBe(200)
  })

  it('previews an item, and imports it as a linked Draft whose Import Session writes v1', async () => {
    const projectId = await adoProject('Customer Portal')
    ado.add({
      id: 42,
      project: 'Customer Portal',
      parentId: 100,
      fields: {
        'System.WorkItemType': 'Product Backlog Item',
        'System.Title': 'Bulk archive',
        [ADO_FIELDS.description]: '<p>As a Manager I archive many devices.</p>',
      },
    })
    const preview = await call('POST', `/api/projects/${projectId}/work-items/lookup`, { workItem: '#42' })
    expect(preview.body).toMatchObject({ id: 42, workItemType: 'PBI', title: 'Bulk archive', parentId: 100 })
    expect(preview.body.refusal).toBeUndefined()

    const start = vi.spyOn(backend.supervisor, 'start').mockResolvedValue({ id: 'sess-import' } as never)
    const wrongTemplate = await call('POST', `/api/projects/${projectId}/drafts/import`, {
      workItem: '42',
      templateId: 'default-bug',
    })
    expect(wrongTemplate.status).toBeGreaterThanOrEqual(400)
    const imported = await call('POST', `/api/projects/${projectId}/drafts/import`, {
      workItem: '42',
      templateId: defaultPbiTemplate.id,
    })
    expect(imported.status).toBe(200)
    const draft = imported.body.draft as Draft
    expect(start).toHaveBeenCalledWith({ projectId, draftId: draft.id, kind: 'import' })
    expect(draft).toMatchObject({
      workItemType: 'PBI',
      version: 0,
      linkedWorkItem: { id: 42 },
      publishedSnapshot: { rev: 1, title: 'Bulk archive' },
    })
    expect(draft.requirement).toContain('As a Manager I archive many devices.')
    expect((await call('POST', `/api/projects/${projectId}/work-items/lookup`, { workItem: '42' })).body).toMatchObject(
      {
        linkedDraftId: draft.id,
      },
    )
  })
})

describe('Refresh and revision checks', () => {
  it('refreshes a Copy exactly like a re-paste, and changes nothing when nothing changed', async () => {
    const projectId = await adoProject()
    await connect()
    ado.add({
      id: 100,
      project: 'Billing',
      fields: {
        'System.WorkItemType': 'Feature',
        'System.Title': 'Device archiving',
        [ADO_FIELDS.description]: '<p>BR1</p>',
      },
    })
    await call('POST', `/api/projects/${projectId}/backlog-copies`, {
      workItem: '#100',
      workItemType: 'Feature',
      title: 'Device archiving',
      content: 'BR1',
    })
    const draft = await writtenPbi(projectId)
    await call('PATCH', `/api/projects/${projectId}/drafts/${draft.id}/backlog-references`, {
      backlogReferences: ['ado-100'],
    })
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body).toEqual({
      mayHaveDrift: [],
      changedCopies: {},
    })

    ado.edit(100, { [ADO_FIELDS.description]: '<p>BR1</p><p>BR2 — restore</p>' })
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body.changedCopies).toEqual({
      'ado-100': { from: 1, to: 2 },
    })
    const refreshed = await call('POST', `/api/projects/${projectId}/backlog-copies/ado-100/refresh`)
    expect(refreshed.body).toMatchObject({
      changed: true,
      copy: { revision: 2, adoRev: 2, content: 'BR1\n\nBR2 — restore' },
    })
    expect((await getDraft(projectId, draft.id)).lane).toBe('needs')
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body.changedCopies).toEqual({})

    const again = await call('POST', `/api/projects/${projectId}/backlog-copies/refresh-all`)
    expect(again.body).toEqual({ refreshed: 1, changed: 0, failed: [] })
  })

  it('fetches a Copy from a link instead of a paste, and Refreshes it when fetched again', async () => {
    const projectId = await adoProject()
    await connect()
    ado.add({
      id: 100,
      project: 'Billing',
      fields: {
        'System.WorkItemType': 'Feature',
        'System.Title': 'Device archiving',
        [ADO_FIELDS.description]: '<p>BR1</p>',
        [ADO_FIELDS.acceptanceCriteria]: '<p>AC1</p>',
      },
    })
    const fetchCopy = (workItem: string) =>
      call('POST', `/api/projects/${projectId}/backlog-copies/fetch`, { workItem })

    const first = await fetchCopy(`${ORG_URL}/Billing/_workitems/edit/100`)
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({
      created: true,
      copy: {
        id: 'ado-100',
        workItemType: 'Feature',
        title: 'Device archiving',
        content: 'BR1',
        acceptanceCriteria: 'AC1',
        revision: 1,
        adoRev: 1,
      },
    })
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body.changedCopies).toEqual({})

    ado.edit(100, { [ADO_FIELDS.description]: '<p>BR1</p><p>BR2</p>' })
    expect((await fetchCopy('#100')).body).toMatchObject({
      created: false,
      changed: true,
      copy: { revision: 2, adoRev: 2, content: 'BR1\n\nBR2' },
    })
    expect((await call('GET', `/api/projects/${projectId}/backlog-copies`)).body).toHaveLength(1)

    expect((await fetchCopy('https://dev.azure.com/other-org/X/_workitems/edit/100')).status).toBeGreaterThanOrEqual(
      400,
    )
  })

  it('shows possible Drift on a linked Draft whose item has a newer revision, without moving its Lane', async () => {
    const projectId = await adoProject('Customer Portal')
    const draft = await writtenPbi(projectId)
    ado.add({
      id: 9,
      project: 'Customer Portal',
      parentId: 100,
      fields: { 'System.WorkItemType': 'Product Backlog Item' },
    })
    expect((await publishTo(projectId, draft.id, '9')).status).toBe(200)
    ado.edit(9, { 'System.State': 'Committed' })
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body.mayHaveDrift).toEqual([draft.id])
    expect((await getDraft(projectId, draft.id)).lane).toBe('review')

    const checked = await call('POST', `/api/projects/${projectId}/drafts/${draft.id}/drift-check`)
    expect(checked.body.drift).toMatchObject({ changes: [] })
    expect((await call('GET', `/api/projects/${projectId}/revisions`)).body.mayHaveDrift).toEqual([])
    expect(sectionByKey(await getDraft(projectId, draft.id), 'userStory')).toBeDefined()
  })
})
