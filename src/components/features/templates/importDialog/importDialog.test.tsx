import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { ImportItem } from '#core/template/templateBundle.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import type { ImportPreview } from '@/api/templatesApi'
import { ImportDialog } from '@/components/features/templates/importDialog/importDialog'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const items: ImportItem[] = [
  { template: { ...defaultPbiTemplate, id: 'a', name: 'Team PBI' }, status: 'new', selected: true },
  { template: { ...defaultPbiTemplate, id: 'b', name: 'Changed PBI' }, status: 'changed', selected: false },
  { template: { ...defaultPbiTemplate, id: 'c', name: 'Same PBI' }, status: 'identical', selected: false },
]

const previewWith = (body: ImportPreview) =>
  server.use(http.post(`*${endpoints.templatesImportPreview}`, () => HttpResponse.json(body)))

describe('ImportDialog', () => {
  it('previews the bundle with only new Templates selected', async () => {
    previewWith({ ok: true, items })
    render(<ImportDialog bundle={{ templates: [] }} onClose={() => {}} />)

    expect(await screen.findByRole('checkbox', { name: /Team PBI/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Changed PBI/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Same PBI/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Import 1' })).toBeEnabled()
  })

  it('shows why a bundle cannot be imported', async () => {
    previewWith({ ok: false, reason: 'Not a Template bundle.' })
    render(<ImportDialog bundle={{}} onClose={() => {}} />)

    expect(await screen.findByText('Not a Template bundle.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Import/ })).toBeDisabled()
  })

  it('shows the error when the preview request fails', async () => {
    server.use(
      http.post(`*${endpoints.templatesImportPreview}`, () =>
        HttpResponse.json({ error: 'Backend down' }, { status: 500 }),
      ),
    )
    render(<ImportDialog bundle={{}} onClose={() => {}} />)

    expect(await screen.findByText('Backend down')).toBeInTheDocument()
  })

  it('imports the ticked Templates and closes', async () => {
    previewWith({ ok: true, items })
    let sent: unknown
    server.use(
      http.post(`*${endpoints.templatesImport}`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json([items[0].template, items[1].template])
      }),
    )
    const onClose = vi.fn()
    const { user } = render(<ImportDialog bundle={{ templates: [] }} onClose={onClose} />)

    await user.click(await screen.findByRole('checkbox', { name: /Changed PBI/ }))
    await user.click(screen.getByRole('button', { name: 'Import 2' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(sent).toEqual({ bundle: { templates: [] }, selected: [0, 1] })
    expect(await screen.findByText('Imported 2 Templates.')).toBeInTheDocument()
  })

  it('is closed without a bundle', () => {
    render(<ImportDialog bundle={null} onClose={() => {}} />)
    expect(screen.queryByText('Import Templates')).not.toBeInTheDocument()
  })
})
