import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Template } from '#core/template/templateTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'
import { endpoints } from '@/api/endpoints/endpoints'
import TemplateEditorPage from '@/pages/TemplateEditorPage/TemplateEditorPage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const mine: Template = {
  ...defaultPbiTemplate,
  id: 'mine',
  name: 'Team PBI',
  isDefault: false,
  origin: { sessionId: 'ts1', at: '2026-09-20T10:00:00Z' },
  sections: [
    { key: 'story', heading: 'Story', shape: 'prose', locked: true, guidance: '', target: 'System.Description' },
    { key: 'acs', heading: 'ACs', shape: 'entries', locked: false, guidance: '', target: 'Microsoft.VSTS.Common.AcceptanceCriteria', entryFormat: 'gherkin' },
  ],
}
let saved: Template | undefined
let deleted = false
const renderPage = (id: string) => render(<TemplateEditorPage />, { route: `/templates/${id}`, path: '/templates/:templateId' })

describe('TemplateEditorPage', () => {
  beforeEach(() => {
    saved = undefined
    deleted = false
    server.use(
      http.get(`*${endpoints.templates}`, () => HttpResponse.json([defaultPbiTemplate, mine])),
      http.put(`*${endpoints.template('mine')}`, async ({ request }) => {
        saved = ((await request.json()) as { template: Template }).template
        return HttpResponse.json({ ...saved, version: mine.version + 1 })
      }),
      http.delete(`*${endpoints.template('mine')}`, () => {
        deleted = true
        return HttpResponse.json({ ok: true })
      }),
      http.post(`*${endpoints.templates}`, async ({ request }) => HttpResponse.json({ ...((await request.json()) as { template: Template }).template, id: 'copy' })),
    )
  })

  it('shows a Default read-only and offers a copy', async () => {
    const { user } = renderPage(defaultPbiTemplate.id)
    expect(await screen.findByText('Default, read-only')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Save as/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Duplicate to customise/ }))
    // The copy opens in this same editor route; it is not in the stubbed list, so the page says so.
    expect(await screen.findByText('This Template no longer exists.')).toBeInTheDocument()
  })

  it('edits, reorders and adds Sections, then saves as the next version', async () => {
    const { user } = renderPage('mine')
    expect(await screen.findByRole('link', { name: 'Read the transcript' })).toHaveAttribute('href', '/templates/session/ts1')
    const save = screen.getByRole('button', { name: 'Save as v2' })
    expect(save).toBeDisabled()

    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0])
    await user.click(screen.getByRole('button', { name: /Add Section/ }))
    const headings = screen.getAllByRole('textbox', { name: 'Heading' })
    await user.type(headings[2], 'Open questions!')
    expect(screen.getAllByRole('textbox', { name: 'Key' })[2]).toHaveValue('openQuestions')
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Shape' })[2], 'entries')
    await user.click(screen.getAllByRole('checkbox', { name: /Given \/ When \/ Then/ }).at(-1)!)
    await user.click(save)

    await vi.waitFor(() => expect(saved).toBeDefined())
    expect(saved!.sections.map((s) => s.key)).toEqual(['acs', 'story', 'openQuestions'])
    expect(saved!.sections[2]).toMatchObject({ heading: 'Open questions!', shape: 'entries', entryFormat: 'gherkin' })
    expect(await screen.findByText(/Saved as v2/)).toBeInTheDocument()
  })

  it('refuses invalid input with a message', async () => {
    const { user } = renderPage('mine')
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await user.clear(name)
    const keys = screen.getAllByRole('textbox', { name: 'Key' })
    await user.clear(keys[1])
    await user.type(keys[1], 'story')
    await user.click(screen.getByRole('button', { name: 'Save as v2' }))
    expect(await screen.findByText('Name the Template')).toBeInTheDocument()
    expect(screen.getByText('Each key must be unique')).toBeInTheDocument()
    expect(saved).toBeUndefined()
  })

  it('discards unsaved changes and removes a Section', async () => {
    const { user } = renderPage('mine')
    await user.click((await screen.findAllByRole('button', { name: 'Remove Section' }))[1])
    expect(screen.getAllByRole('textbox', { name: 'Heading' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getAllByRole('textbox', { name: 'Heading' })).toHaveLength(2)
  })

  it('deletes the Template after confirming', async () => {
    const { user } = renderPage('mine')
    await user.click(await screen.findByRole('button', { name: /Delete Template/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Template' }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
    expect(deleted).toBe(true)
  })

  it('says when the Template is gone', async () => {
    renderPage('gone')
    expect(await screen.findByText('This Template no longer exists.')).toBeInTheDocument()
  })
})
