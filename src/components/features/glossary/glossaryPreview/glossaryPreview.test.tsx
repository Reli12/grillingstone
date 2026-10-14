// Tests for GlossaryPreview: term names linking into the Glossary tab, no editing, and live updates.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { addTerm } from '#core/glossary/glossary.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { applyServerEvent } from '@/api/serverEvents'
import { GlossaryPreview } from '@/components/features/glossary/glossaryPreview/glossaryPreview'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const withDevice = addTerm('', { term: 'Archived Device', definition: 'Hidden, still billed.', avoid: '' }, 'Portal')
let markdown: string

describe('GlossaryPreview', () => {
  beforeEach(() => {
    markdown = withDevice
    server.use(http.get(`*${endpoints.glossary('portal')}`, () => HttpResponse.json({ markdown, version: markdown })))
  })

  it('lists term names that open the Glossary tab at that term, and links to the whole Glossary', async () => {
    render(<GlossaryPreview projectId="portal" />)
    expect(await screen.findByRole('link', { name: 'Archived Device' })).toHaveAttribute(
      'href',
      '/p/portal/glossary?term=Archived%20Device',
    )
    expect(screen.getByRole('link', { name: /Open Glossary/ })).toHaveAttribute('href', '/p/portal/glossary')
    expect(screen.getByText('1 term')).toBeInTheDocument()
  })

  it('offers no editing', async () => {
    render(<GlossaryPreview projectId="portal" />)
    await screen.findByRole('link', { name: 'Archived Device' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden, still billed.')).not.toBeInTheDocument()
  })

  it('points to the Glossary tab when there are no terms yet', async () => {
    markdown = ''
    render(<GlossaryPreview projectId="portal" />)
    expect(
      await screen.findByText(
        'No terms yet. Claude adds them as they are settled during grilling, or add one in the Glossary tab.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Glossary/ })).toBeInTheDocument()
  })

  it('shows a term Claude adds without a reload', async () => {
    const { queryClient } = render(<GlossaryPreview projectId="portal" />)
    await screen.findByRole('link', { name: 'Archived Device' })
    markdown = addTerm(withDevice, { term: 'Site', definition: 'Where devices live.', avoid: '' })
    applyServerEvent(queryClient, { type: 'glossary', projectId: 'portal' })
    expect(await screen.findByRole('link', { name: 'Site' })).toBeInTheDocument()
    expect(screen.getByText('2 terms')).toBeInTheDocument()
  })
})
