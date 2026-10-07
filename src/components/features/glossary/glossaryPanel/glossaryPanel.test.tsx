import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addTerm } from '#core/glossary/glossary.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const withDevice = addTerm('', { term: 'Device', definition: 'A metered unit.', avoid: 'asset' }, 'Customer Portal')
let saved: { markdown: string; baseVersion: string } | undefined

describe('GlossaryPanel', () => {
  beforeEach(() => {
    saved = undefined
    server.use(
      http.get(`*${endpoints.project('customer-portal')}`, () =>
        HttpResponse.json({ id: 'customer-portal', name: 'Customer Portal', createdAt: '' }),
      ),
      http.get(`*${endpoints.glossary('customer-portal')}`, () =>
        HttpResponse.json({ markdown: withDevice, version: 'v1' }),
      ),
      http.put(`*${endpoints.glossary('customer-portal')}`, async ({ request }) => {
        saved = (await request.json()) as typeof saved
        return HttpResponse.json({ markdown: saved!.markdown, version: 'v2' })
      }),
    )
  })

  it('lists terms with what to avoid', async () => {
    render(<GlossaryPanel projectId="customer-portal" />)
    expect(await screen.findByText('Device')).toBeInTheDocument()
    expect(screen.getByText('Avoid: asset')).toBeInTheDocument()
  })

  it('adds a term', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: /Add term/ }))
    const save = screen.getByRole('button', { name: 'Save term' })
    expect(save).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Term' }), ' Site ')
    await user.type(screen.getByRole('textbox', { name: 'Definition' }), 'Where devices live.')
    await user.click(save)

    await vi.waitFor(() => expect(saved?.baseVersion).toBe('v1'))
    expect(saved!.markdown).toContain('**Site**')
    expect(saved!.markdown).toContain('Where devices live.')
  })

  it('edits and removes a term', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByTitle('Edit term'))
    const term = screen.getByRole('textbox', { name: 'Term' })
    await user.clear(term)
    await user.type(term, 'Meter')
    await user.click(screen.getByRole('button', { name: 'Save term' }))
    await vi.waitFor(() => expect(saved?.markdown).toContain('**Meter**'))

    await user.click(await screen.findByTitle('Edit term'))
    await user.click(screen.getByRole('button', { name: /Remove/ }))
    await vi.waitFor(() => expect(saved?.markdown).not.toContain('Meter'))
  })

  it('cancels an edit', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByTitle('Edit term'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox', { name: 'Term' })).not.toBeInTheDocument()
  })

  it('edits the raw CONTEXT.md', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: 'Edit as markdown' }))
    const raw = screen.getByRole('textbox', { name: 'CONTEXT.md' })
    await user.type(raw, '\nMore.')
    await user.click(screen.getByRole('button', { name: 'Save CONTEXT.md' }))
    await vi.waitFor(() => expect(saved?.markdown).toBe(`${withDevice}\nMore.`))
    expect(within(document.body).queryByRole('textbox', { name: 'CONTEXT.md' })).not.toBeInTheDocument()
  })
})
