import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Template } from '#core/template/templateTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import TemplatesPage from '@/pages/TemplatesPage/TemplatesPage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const mine: Template = {
  ...defaultPbiTemplate,
  id: 'mine',
  name: 'Team PBI',
  isDefault: false,
  sections: defaultPbiTemplate.sections.slice(0, 1),
}
let created: Template | undefined
const renderPage = () => render(<TemplatesPage />, { route: '/templates', path: '/templates' })

describe('TemplatesPage', () => {
  beforeEach(() => {
    created = undefined
    server.use(
      http.get(`*${endpoints.templates}`, () => HttpResponse.json([defaultPbiTemplate, mine])),
      http.get(`*${endpoints.liveTemplateSession}`, () => HttpResponse.json({ session: null })),
      http.post(`*${endpoints.templates}`, async ({ request }) => {
        created = ((await request.json()) as { template: Template }).template
        return HttpResponse.json({ ...created, id: 'copy' })
      }),
    )
  })

  it('lists Templates by Work Item Type', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: /Team PBI\s*v1, 1 Section$/ })).toBeInTheDocument()
    expect(screen.getByText('Default, read-only')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Epic' })).toBeInTheDocument()
  })

  it('duplicates a Default as "My …"', async () => {
    const { user } = renderPage()
    await user.click((await screen.findAllByRole('button', { name: /Duplicate/ }))[0])
    await screen.findByTestId('navigated')
    expect(created?.name).toBe(defaultPbiTemplate.name.replace(/^Default /, 'My '))
  })

  it('duplicates a custom Template as a copy', async () => {
    const { user } = renderPage()
    await user.click((await screen.findAllByRole('button', { name: /Duplicate/ }))[1])
    await screen.findByTestId('navigated')
    expect(created?.name).toBe('Team PBI (copy)')
  })

  it('exports the selected Templates as a file', async () => {
    let ids: unknown
    server.use(
      http.post(`*${endpoints.templatesExport}`, async ({ request }) => {
        ids = await request.json()
        return HttpResponse.json({ templates: [] })
      }),
    )
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderPage()

    const exportButton = await screen.findByRole('button', { name: /Export selected/ })
    expect(exportButton).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Select Team PBI for export' }))
    await user.click(screen.getByRole('checkbox', { name: `Select ${defaultPbiTemplate.name} for export` }))
    await user.click(screen.getByRole('checkbox', { name: `Select ${defaultPbiTemplate.name} for export` }))
    await user.click(screen.getByRole('button', { name: /Export 1 selected/ }))

    await vi.waitFor(() => expect(click).toHaveBeenCalled())
    expect(ids).toEqual({ ids: ['mine'] })
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('opens an imported bundle for preview, and refuses a file that is not JSON', async () => {
    server.use(http.post(`*${endpoints.templatesImportPreview}`, () => HttpResponse.json({ ok: true, items: [] })))
    const { user, container } = renderPage()
    await screen.findByRole('button', { name: /Import bundle/ })
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!

    await user.upload(input, new File(['nope'], 'bad.json', { type: 'application/json' }))
    expect(await screen.findByText('That file is not valid JSON.')).toBeInTheDocument()

    await user.upload(input, new File(['{"templates":[]}'], 'bundle.json', { type: 'application/json' }))
    expect(await screen.findByText('Import Templates')).toBeInTheDocument()
  })

  it('points to a running Template Session', async () => {
    server.use(
      http.get(`*${endpoints.liveTemplateSession}`, () =>
        HttpResponse.json({
          session: {
            id: 'ts',
            kind: 'template',
            status: 'waiting',
            writeConfirmed: false,
            startedAt: '',
            request: { workItemType: 'Feature', purpose: '', examples: '' },
          },
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText(/new Feature Template is running — your turn/)).toBeInTheDocument()
  })
})
