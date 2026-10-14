// Tests for GlossaryPanel: listing, adding, editing and removing terms, and editing the raw CONTEXT.md.
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addTerm } from '#core/glossary/glossary.ts'

import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
import { type GlossaryBackend, glossaryBackend } from '@test/mocks/glossaryBackend'
import { render } from '@test/utils/testUtils'

const withDevice = addTerm('', { term: 'Device', definition: 'A metered unit.', avoid: 'asset' }, 'Customer Portal')
// Claude added 'Account' above 'Device' while the human was editing.
const threeTerms = [
  { term: 'Glossary', definition: 'The shared domain terms.', avoid: 'dictionary' },
  { term: 'Iteration', definition: 'Turns a Proposal into the next version.', avoid: '' },
].reduce((md, term) => addTerm(md, term), withDevice)
const withAccount = withDevice.replace('**Device**', '**Account**:\nA customer.\n\n**Device**')
let backend: GlossaryBackend

describe('GlossaryPanel', () => {
  beforeEach(() => {
    backend = glossaryBackend('customer-portal', withDevice)
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

    await vi.waitFor(() => expect(backend.lastSave?.baseVersion).toBe('v1'))
    expect(backend.lastSave!.markdown).toContain('**Site**')
    expect(backend.lastSave!.markdown).toContain('Where devices live.')
  })

  it('edits and removes a term', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: /^Device/ }))
    const term = screen.getByRole('textbox', { name: 'Term' })
    await user.clear(term)
    await user.type(term, 'Meter')
    await user.click(screen.getByRole('button', { name: 'Save term' }))
    await vi.waitFor(() => expect(backend.lastSave?.markdown).toContain('**Meter**'))

    await user.click(await screen.findByRole('button', { name: /^Meter/ }))
    await user.click(screen.getByRole('button', { name: /Remove/ }))
    await vi.waitFor(() => expect(backend.lastSave?.markdown).not.toContain('Meter'))
  })

  it('cancels an edit', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: /^Device/ }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox', { name: 'Term' })).not.toBeInTheDocument()
  })

  it('edits the raw CONTEXT.md', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: 'Edit as markdown' }))
    const raw = screen.getByRole('textbox', { name: 'CONTEXT.md' })
    await user.type(raw, '\nMore.')
    await user.click(screen.getByRole('button', { name: 'Save CONTEXT.md' }))
    await vi.waitFor(() => expect(backend.lastSave?.markdown).toBe(`${withDevice}\nMore.`))
    expect(within(document.body).queryByRole('textbox', { name: 'CONTEXT.md' })).not.toBeInTheDocument()
  })

  it('refuses a stale term save, keeps the typed text, and applies it to the same term on the next save', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: /^Device/ }))
    backend.current = { markdown: withAccount, version: 'v2' }
    const definition = screen.getByRole('textbox', { name: 'Definition' })
    await user.clear(definition)
    await user.type(definition, 'A smart meter.')
    await user.click(screen.getByRole('button', { name: 'Save term' }))

    expect(await screen.findByText(/The Glossary changed while you were editing/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Definition' })).toHaveValue('A smart meter.')
    expect(backend.saves).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Save term' }))
    await vi.waitFor(() => expect(backend.lastSave?.baseVersion).toBe('v2'))
    expect(backend.lastSave!.markdown).toContain('**Account**:\nA customer.')
    expect(backend.lastSave!.markdown).toContain('**Device**:\nA smart meter.')
  })

  it('refuses a stale markdown save and lets the human keep or discard their text', async () => {
    const { user } = render(<GlossaryPanel projectId="customer-portal" />)
    await user.click(await screen.findByRole('button', { name: 'Edit as markdown' }))
    backend.current = { markdown: withAccount, version: 'v2' }
    await user.type(screen.getByRole('textbox', { name: 'CONTEXT.md' }), '\nMine.')
    await user.click(screen.getByRole('button', { name: 'Save CONTEXT.md' }))

    expect(await screen.findByText(/The Glossary changed while you were editing/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'CONTEXT.md' })).toHaveValue(`${withDevice}\nMine.`)
    expect(screen.getByRole('button', { name: 'Discard and reload' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save mine anyway' }))
    await vi.waitFor(() => expect(backend.lastSave).toEqual({ markdown: `${withDevice}\nMine.`, baseVersion: 'v2' }))
  })

  describe('on a long Glossary', () => {
    beforeEach(() => {
      backend.current = { markdown: threeTerms, version: 'v1' }
    })
    const filterBox = () => screen.getByRole('searchbox', { name: 'Filter terms' })
    const listed = () => screen.getAllByRole('term').map((term) => term.textContent)

    it('lists each term on one line, with the full definition on hover and a count', async () => {
      render(<GlossaryPanel projectId="customer-portal" />)
      expect(await screen.findByRole('button', { name: /^Iteration/ })).toHaveAttribute(
        'title',
        'Turns a Proposal into the next version.',
      )
      expect(screen.getByText('3 terms')).toBeInTheDocument()
    })

    it('filters by name, definition or alias in any letter case, and clears back to all', async () => {
      const { user } = render(<GlossaryPanel projectId="customer-portal" />)
      await screen.findByText('3 terms')
      await user.type(filterBox(), 'GLOSS')
      expect(listed()).toEqual(['Glossary'])
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
      await user.clear(filterBox())
      await user.type(filterBox(), 'DICTIONARY')
      expect(listed()).toEqual(['Glossary'])
      await user.clear(filterBox())
      await user.type(filterBox(), 'proposal')
      expect(listed()).toEqual(['Iteration'])
      await user.clear(filterBox())
      expect(listed()).toEqual(['Device', 'Glossary', 'Iteration'])
    })

    it('says when nothing matches', async () => {
      const { user } = render(<GlossaryPanel projectId="customer-portal" />)
      await user.type(await screen.findByRole('searchbox', { name: 'Filter terms' }), 'zzz')
      expect(screen.getByText('No terms match "zzz".')).toBeInTheDocument()
    })

    it('disables the filter while editing the whole markdown, then applies it again', async () => {
      const { user } = render(<GlossaryPanel projectId="customer-portal" />)
      await user.type(await screen.findByRole('searchbox', { name: 'Filter terms' }), 'gloss')
      await user.click(screen.getByRole('button', { name: 'Edit as markdown' }))
      expect(filterBox()).toBeDisabled()
      expect(screen.getByRole('textbox', { name: 'CONTEXT.md' })).toHaveValue(threeTerms)
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(filterBox()).toBeEnabled()
      expect(listed()).toEqual(['Glossary'])
    })

    it('clears the filter when adding a term', async () => {
      const { user } = render(<GlossaryPanel projectId="customer-portal" />)
      await user.type(await screen.findByRole('searchbox', { name: 'Filter terms' }), 'gloss')
      await user.click(screen.getByRole('button', { name: /Add term/ }))
      expect(filterBox()).toHaveValue('')
      expect(listed()).toEqual(['Device', 'Glossary', 'Iteration'])
      expect(screen.getByRole('textbox', { name: 'Term' })).toHaveValue('')
    })

    it('keeps a just-edited term listed although it no longer matches the filter', async () => {
      const { user } = render(<GlossaryPanel projectId="customer-portal" />)
      await user.type(await screen.findByRole('searchbox', { name: 'Filter terms' }), 'device')
      await user.click(screen.getByRole('button', { name: /^Device/ }))
      const term = screen.getByRole('textbox', { name: 'Term' })
      await user.clear(term)
      await user.type(term, 'Meter')
      await user.click(screen.getByRole('button', { name: 'Save term' }))
      await vi.waitFor(() => expect(listed()).toEqual(['Meter']))
    })
  })

  describe('opened at a term', () => {
    const scrollIntoView = vi.fn()
    beforeEach(() => {
      backend.current = { markdown: threeTerms, version: 'v1' }
      Element.prototype.scrollIntoView = scrollIntoView
    })
    afterEach(() => {
      scrollIntoView.mockClear()
    })

    it('scrolls to and highlights the term named in the URL, ignoring case', async () => {
      render(<GlossaryPanel projectId="customer-portal" />, { route: '/?term=iteration' })
      const row = await screen.findByRole('button', { name: /^Iteration/ })
      await vi.waitFor(() => expect(row).toHaveAttribute('data-highlighted', 'true'))
      expect(scrollIntoView).toHaveBeenCalledOnce()
      expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toHaveValue('')
    })

    it('opens at the top without a highlight when the term is gone', async () => {
      render(<GlossaryPanel projectId="customer-portal" />, { route: '/?term=Foo' })
      await screen.findByText('3 terms')
      expect(scrollIntoView).not.toHaveBeenCalled()
      expect(document.querySelector('[data-highlighted="true"]')).toBeNull()
    })
  })
})
