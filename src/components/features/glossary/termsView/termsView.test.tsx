// Tests for TermsView: what it says when nothing is listed, where the editor goes, and that an open edit
// survives its term disappearing from the list.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TermsView } from '@/components/features/glossary/termsView/termsView'
import type { useGlossaryEditing } from '@/hooks/glossary/useGlossaryEditing'
import { render } from '@test/utils/testUtils'

type Editing = ReturnType<typeof useGlossaryEditing>

const device = { term: 'Device', definition: 'A metered unit.', avoid: '' }
const site = { term: 'Site', definition: 'Where devices live.', avoid: '' }
const empty = { term: '', definition: '', avoid: '' }

const editing = (patch: Partial<Editing> = {}): Editing => ({
  doc: undefined,
  edit: null,
  editingIndex: null,
  raw: null,
  stale: false,
  failure: null,
  saving: false,
  startTerm: vi.fn(),
  startNew: vi.fn(),
  startRaw: vi.fn(),
  setRaw: vi.fn(),
  cancel: vi.fn(),
  saveTerm: vi.fn(),
  removeTerm: vi.fn(),
  saveRaw: vi.fn(),
  ...patch,
})

describe('TermsView', () => {
  it('says how to start when the Glossary has no terms', () => {
    render(<TermsView rows={[]} total={0} query="" editing={editing()} highlighted={null} />)
    expect(
      screen.getByText('No terms yet. Claude adds them as they are settled during grilling, or add one yourself.'),
    ).toBeInTheDocument()
  })

  it('says when the filter matches nothing', () => {
    render(<TermsView rows={[]} total={2} query=" zzz " editing={editing()} highlighted={null} />)
    expect(screen.getByText('No terms match "zzz".')).toBeInTheDocument()
  })

  it('opens a clicked term with its place in the Glossary', async () => {
    const startTerm = vi.fn()
    const { user } = render(
      <TermsView
        rows={[{ term: site, index: 3 }]}
        total={4}
        query=""
        editing={editing({ startTerm })}
        highlighted={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^Site/ }))
    expect(startTerm).toHaveBeenCalledWith(3, site)
  })

  it('shows a new term editor below the list, without Remove', () => {
    render(
      <TermsView
        rows={[{ term: device, index: 0 }]}
        total={1}
        query=""
        editing={editing({ edit: { index: null, name: '', term: empty } })}
        highlighted={null}
      />,
    )
    expect(screen.getByRole('textbox', { name: 'Term' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('keeps an open term and its typed text when a live update removes it from the list', async () => {
    const open = { edit: { index: 0, name: 'Device', term: device } }
    const rows = [
      { term: device, index: 0 },
      { term: site, index: 1 },
    ]
    const { user, rerender } = render(
      <TermsView rows={rows} total={2} query="" editing={editing({ ...open, editingIndex: 0 })} highlighted={null} />,
    )
    const definition = screen.getByRole('textbox', { name: 'Definition' })
    await user.clear(definition)
    await user.type(definition, 'A smart meter.')

    rerender(
      <TermsView
        rows={[{ term: site, index: 0 }]}
        total={1}
        query=""
        editing={editing({ ...open, editingIndex: null })}
        highlighted={null}
      />,
    )
    expect(screen.getByRole('textbox', { name: 'Definition' })).toHaveValue('A smart meter.')
  })
})
