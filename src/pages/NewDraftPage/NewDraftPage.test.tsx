// Tests for NewDraftPage: starting each Work Item Type with its Template, References and Images. Image preparation
// is stubbed: jsdom has no canvas.
import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import { defaultBugTemplate, defaultPbiTemplate, defaultTaskTemplate } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { type Preparation, prepareImage } from '@/lib/imagePreparation'
import { forgetImageSessions } from '@/lib/imageSessionMemory'
import NewDraftPage from '@/pages/NewDraftPage/NewDraftPage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const featureTemplate = {
  ...defaultPbiTemplate,
  id: 'feature',
  workItemType: 'Feature' as const,
  name: 'Default Feature',
}
const teamPbi = { ...defaultPbiTemplate, id: 'team-pbi', name: 'Team PBI', isDefault: false }
const written: DraftSummary = {
  id: 'd1',
  projectId: 'customer-portal',
  title: 'Archive devices',
  requirement: '',
  workItemType: 'Feature',
  version: 1,
  templateName: '',
  pendingChanges: 0,
  updatedAt: '',
}

vi.mock('@/lib/imagePreparation', () => ({ prepareImage: vi.fn() }))

const READY: Preparation = { ok: true, image: { mediaType: 'image/png', data: 'AAAA', size: 1000 } }
const picture = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })

let sent: unknown
const renderPage = () => render(<NewDraftPage />, { route: '/p/customer-portal/new', path: '/p/:projectId/new' })

describe('NewDraftPage', () => {
  beforeEach(() => {
    sent = undefined
    forgetImageSessions()
    vi.mocked(prepareImage).mockReset()
    vi.mocked(prepareImage).mockResolvedValue(READY)
    server.use(
      http.get(`*${endpoints.project('customer-portal')}`, () =>
        HttpResponse.json({ id: 'customer-portal', name: 'Customer Portal', createdAt: '', tracker: 'azure-devops' }),
      ),
      http.get(`*${endpoints.drafts('customer-portal')}`, () => HttpResponse.json([written])),
      http.get(`*${endpoints.templates}`, () =>
        HttpResponse.json([defaultPbiTemplate, teamPbi, featureTemplate, defaultBugTemplate, defaultTaskTemplate]),
      ),
      http.post(`*${endpoints.drafts('customer-portal')}`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ draft: { id: 'new-draft' }, session: {} })
      }),
    )
  })

  it('starts a PBI in the default Template', async () => {
    const { user } = renderPage()
    const start = await screen.findByRole('button', { name: 'Start grilling' })
    expect(start).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Default PBI/ })).toBeChecked()

    await user.type(screen.getByRole('textbox', { name: 'Requirement' }), 'Managers archive devices. ')
    await user.click(start)

    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
    expect(sent).toEqual({
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: 'Managers archive devices.',
      references: [],
    })
  })

  it('starts a Bug or a Task in its own Default Template, explaining each type', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Bug' }))
    expect(screen.getByText(/defect someone has already observed/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Default Bug Template/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Task' }))
    expect(screen.getByText(/few hours of work/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Default Task Template/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Bug' }))
    await user.type(screen.getByRole('textbox', { name: 'Requirement' }), 'Blank page after paying')
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))

    await screen.findByTestId('navigated')
    expect(sent).toEqual({
      workItemType: 'Bug',
      templateId: defaultBugTemplate.id,
      requirement: 'Blank page after paying',
      references: [],
    })
  })

  it('sends the chosen Template, type and References', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Feature' }))
    expect(screen.getByRole('radio', { name: /Default Feature/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'PBI' }))
    await user.click(screen.getByRole('radio', { name: /Team PBI/ }))
    await user.click(screen.getByRole('checkbox', { name: /Archive devices/ }))
    await user.type(screen.getByRole('textbox', { name: 'Requirement' }), 'Bulk archive')
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))

    await screen.findByTestId('navigated')
    expect(sent).toEqual({
      workItemType: 'PBI',
      templateId: 'team-pbi',
      requirement: 'Bulk archive',
      references: ['d1'],
    })
  })

  it('can untick a Reference again', async () => {
    const { user } = renderPage()
    const ref = await screen.findByRole('checkbox', { name: /Archive devices/ })
    await user.click(ref)
    await user.click(ref)
    expect(ref).not.toBeChecked()
  })

  it("offers a Jira Project only Jira's types and Templates, starting on a Story", async () => {
    const jiraStory = {
      ...defaultPbiTemplate,
      id: 'jira-story',
      tracker: 'jira' as const,
      workItemType: 'Story' as const,
      name: 'Default Jira Story Template',
    }
    server.use(
      http.get(`*${endpoints.project('customer-portal')}`, () =>
        HttpResponse.json({ id: 'customer-portal', name: 'Customer Portal', createdAt: '', tracker: 'jira' }),
      ),
      http.get(`*${endpoints.templates}`, () => HttpResponse.json([defaultPbiTemplate, jiraStory])),
    )
    const { user } = renderPage()
    expect(await screen.findByRole('radio', { name: 'Story' })).toHaveAttribute('aria-checked', 'true')
    for (const type of ['Epic', 'Task', 'Sub-task', 'Bug'])
      expect(screen.getByRole('radio', { name: type })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'PBI' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Default PBI/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Default Jira Story Template/ })).toBeChecked()

    await user.type(screen.getByRole('textbox', { name: 'Requirement' }), 'Archive devices')
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
    expect(sent).toMatchObject({ workItemType: 'Story', templateId: 'jira-story' })
  })

  it('starts the first session with Images pasted into the requirement', async () => {
    const { user } = renderPage()
    const requirement = await screen.findByRole('textbox', { name: 'Requirement' })
    await user.type(requirement, 'Archive devices like this frame')
    fireEvent.paste(requirement, { clipboardData: { files: [picture('frame.png')] } })
    const thumbnails = await screen.findByRole('list', { name: 'Images to send' })
    expect(within(thumbnails).getByRole('img', { name: 'frame.png' })).toBeInTheDocument()
    expect(await screen.findByText(/Images are sent to Claude/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    await screen.findByTestId('navigated')
    expect(sent).toEqual({
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: 'Archive devices like this frame',
      references: [],
      images: [{ mediaType: 'image/png', data: 'AAAA' }],
    })
  })

  it('adds an Image from the picker and takes it back with ✕', async () => {
    const { user } = renderPage()
    await user.upload(await screen.findByLabelText('Image files'), picture('picked.png'))
    const thumbnails = await screen.findByRole('list', { name: 'Images to send' })
    await user.click(within(thumbnails).getByRole('button', { name: 'Remove picked.png' }))
    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument()
  })
})
