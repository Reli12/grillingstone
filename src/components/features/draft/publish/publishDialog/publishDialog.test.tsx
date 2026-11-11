// Tests for the Publish dialog: what a create shows and sends, every reason a blocked Publish gives, an update
// that overwrites a change made in Azure DevOps, and a parent typed by ID or link.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { PlanResult } from '@/api/adoApi'
import { endpoints } from '@/api/endpoints/endpoints'
import { PublishDialog } from '@/components/features/draft/publish/publishDialog/publishDialog'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const PROJECT = 'customer-portal'
const DRAFT = 'd-1'

const createPlan: PlanResult = {
  defaultTags: ['sems'],
  choosesTarget: false,
  plan: {
    ok: true,
    mode: 'create',
    workItemType: 'PBI',
    adoType: 'Product Backlog Item',
    title: 'Archive device',
    addParent: 100,
    backlog: 'Customer Portal',
    areaPath: 'Customer Portal\\Devices',
    iterationPath: 'Customer Portal',
    tags: ['sems'],
    fields: [
      { field: 'System.Title', label: 'Title', value: 'Archive device' },
      { field: 'System.Description', label: 'Description', value: '<h2>User Story</h2>\n<p>As a Manager…</p>' },
    ],
  },
}

const answer = (result: PlanResult) =>
  server.use(http.post(`*${endpoints.publishPlan(PROJECT, DRAFT)}`, () => HttpResponse.json(result)))

describe('PublishDialog', () => {
  it('shows what a create writes, and sends the tags chosen for this item', async () => {
    answer(createPlan)
    const sent: unknown[] = []
    server.use(
      http.post(`*${endpoints.publish(PROJECT, DRAFT)}`, async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ draft: {}, workItemId: 900, url: 'https://x', created: true })
      }),
    )
    const onClose = vi.fn()
    const { user } = render(<PublishDialog projectId={PROJECT} draftId={DRAFT} open onClose={onClose} />)
    expect(await screen.findByText('a Product Backlog Item in Customer Portal')).toBeInTheDocument()
    expect(screen.getByText('#100')).toBeInTheDocument()
    expect(screen.getByText('Customer Portal\\Devices')).toBeInTheDocument()
    const tags = screen.getByRole('textbox')
    expect(tags).toHaveValue('sems')
    await user.type(tags, '; frontend')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await vi.waitFor(() => expect(sent).toEqual([{ tags: ['sems', 'frontend'], expectedRev: null }]))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('lists every reason Publish is blocked, and offers no Publish', async () => {
    answer({
      defaultTags: [],
      choosesTarget: false,
      plan: {
        ok: false,
        reasons: [
          { code: 'backlog', message: 'Choose this Project’s Backlog in its Settings first.' },
          { code: 'parentMissing', message: 'A PBI needs a parent.' },
        ],
      },
    })
    render(<PublishDialog projectId={PROJECT} draftId={DRAFT} open onClose={() => {}} />)
    expect(await screen.findByText('A PBI needs a parent.')).toBeInTheDocument()
    expect(screen.getByText(/Backlog in its Settings/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('shows an update as before → after, warns what it overwrites, and sends the revision it was made from', async () => {
    answer({
      defaultTags: [],
      choosesTarget: false,
      plan: {
        ok: true,
        mode: 'update',
        workItemType: 'PBI',
        adoType: 'Product Backlog Item',
        title: 'Archive a device',
        addParent: null,
        workItemId: 501,
        url: 'https://dev.azure.com/acme/P/_workitems/edit/501',
        parentId: 100,
        expectedRev: 7,
        overwrites: ['Title'],
        fields: [{ field: 'System.Title', label: 'Title', value: 'Archive a device', before: 'Renamed by the PO' }],
      },
    })
    const sent: unknown[] = []
    server.use(
      http.post(`*${endpoints.publish(PROJECT, DRAFT)}`, async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ draft: {}, workItemId: 501, url: 'https://x', created: false })
      }),
    )
    const { user } = render(<PublishDialog projectId={PROJECT} draftId={DRAFT} open onClose={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone changed Title in Azure DevOps')
    expect(screen.getByText('Renamed by the PO')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publish update' }))
    expect(screen.getByText('#100 (kept)')).toBeInTheDocument()
    await vi.waitFor(() => expect(sent).toEqual([{ tags: [], expectedRev: 7 }]))
  })

  it('plans with a parent typed by ID or link, and Publishes under it', async () => {
    const asked: unknown[] = []
    server.use(
      http.post(`*${endpoints.publishPlan(PROJECT, DRAFT)}`, async ({ request }) => {
        const body = (await request.json()) as { parent?: string }
        asked.push(body)
        if (!body.parent)
          return HttpResponse.json({
            defaultTags: [],
            choosesTarget: false,
            parent: { workItemId: null, title: null, adoType: null, typed: false },
            plan: { ok: false, reasons: [{ code: 'parentMissing', message: 'A PBI needs a parent.' }] },
          } satisfies PlanResult)
        return HttpResponse.json({
          ...createPlan,
          parent: { workItemId: 100, title: 'Device archiving', adoType: 'Feature', typed: true },
        } satisfies PlanResult)
      }),
    )
    const sent: unknown[] = []
    server.use(
      http.post(`*${endpoints.publish(PROJECT, DRAFT)}`, async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ draft: {}, workItemId: 900, url: 'https://x', created: true })
      }),
    )
    const { user } = render(<PublishDialog projectId={PROJECT} draftId={DRAFT} open onClose={() => {}} />)
    expect(await screen.findByText('A PBI needs a parent.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Parent'), 'https://dev.azure.com/acme/P/_workitems/edit/100{Enter}')
    expect(await screen.findByText('Feature #100 · Device archiving')).toBeInTheDocument()
    expect(asked).toContainEqual({ parent: 'https://dev.azure.com/acme/P/_workitems/edit/100' })
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await vi.waitFor(() =>
      expect(sent).toEqual([
        { tags: ['sems'], expectedRev: null, parent: 'https://dev.azure.com/acme/P/_workitems/edit/100' },
      ]),
    )
  })

  it('updates an existing item instead of creating one, once it is named, and sends it with the Publish', async () => {
    const asked: unknown[] = []
    server.use(
      http.post(`*${endpoints.publishPlan(PROJECT, DRAFT)}`, async ({ request }) => {
        const body = (await request.json()) as { existing?: string }
        asked.push(body)
        if (!body.existing) return HttpResponse.json({ ...createPlan, choosesTarget: true } satisfies PlanResult)
        return HttpResponse.json({
          defaultTags: ['sems'],
          choosesTarget: true,
          plan: {
            ok: true,
            mode: 'update',
            workItemType: 'PBI',
            adoType: 'Product Backlog Item',
            title: 'Archive device',
            addParent: null,
            parentId: 100,
            workItemId: 9,
            url: 'https://dev.azure.com/acme/P/_workitems/edit/9',
            expectedRev: 3,
            overwrites: [],
            fields: [{ field: 'System.Title', label: 'Title', value: 'Archive device', before: 'Written by hand' }],
          },
        } satisfies PlanResult)
      }),
    )
    const sent: unknown[] = []
    server.use(
      http.post(`*${endpoints.publish(PROJECT, DRAFT)}`, async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ draft: {}, workItemId: 9, url: 'https://x', created: false })
      }),
    )
    const { user } = render(<PublishDialog projectId={PROJECT} draftId={DRAFT} open onClose={() => {}} />)
    expect(await screen.findByRole('radio', { name: 'Create a new work item' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Update an existing work item' }))
    expect(screen.getByRole('button', { name: 'Publish update' })).toBeDisabled()
    expect(screen.queryByText('Archive device')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Existing work item'), '9{Enter}')
    expect(await screen.findByText('Written by hand')).toBeInTheDocument()
    expect(screen.getByText('#100 (kept)')).toBeInTheDocument()
    expect(asked).toContainEqual({ existing: '9' })
    await user.click(screen.getByRole('button', { name: 'Publish update' }))
    await vi.waitFor(() => expect(sent).toEqual([{ tags: ['sems'], expectedRev: 3, existing: '9' }]))
  })
})
