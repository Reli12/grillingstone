// Tests for useGlossaryEditing: opening and closing edits, saving against the Glossary an edit started from,
// and never losing or misplacing the human's change when the Glossary changes meanwhile.
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addTerm, removeTerm, updateTerm } from '#core/glossary/glossary.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import { queryKeys } from '@/api/reactQueryKeys'
import { useGlossaryEditing } from '@/hooks/glossary/useGlossaryEditing'
import { type GlossaryBackend, glossaryBackend } from '@test/mocks/glossaryBackend'
import { server } from '@test/mocks/server'
import { renderHook } from '@test/utils/testUtils'

const device = { term: 'Device', definition: 'A metered unit.', avoid: 'asset' }
const site = { term: 'Site', definition: 'Where devices live.', avoid: '' }
const twoTerms = addTerm(addTerm('', device, 'Customer Portal'), site)
// Claude added 'Account' above 'Device' meanwhile.
const withAccount = twoTerms.replace('**Device**', '**Account**:\nA customer.\n\n**Device**')
let backend: GlossaryBackend

async function setup() {
  const onTermSaved = vi.fn()
  const rendered = renderHook(() => useGlossaryEditing('customer-portal', { onTermSaved }))
  await waitFor(() => expect(rendered.result.current.doc).toBeDefined())
  return { ...rendered, onTermSaved }
}

describe('useGlossaryEditing', () => {
  beforeEach(() => {
    backend = glossaryBackend('customer-portal', twoTerms)
  })

  it('opens a term, a new term or the whole markdown, one at a time, and closes again', async () => {
    const { result } = await setup()
    act(() => result.current.startTerm(1, site))
    expect(result.current.edit).toEqual({ index: 1, name: 'Site', term: site })
    expect(result.current.editingIndex).toBe(1)

    act(() => result.current.startNew())
    expect(result.current.edit).toMatchObject({ index: null, name: '' })
    expect(result.current.editingIndex).toBeNull()

    act(() => result.current.startRaw())
    expect(result.current.edit).toBeNull()
    expect(result.current.raw).toBe(twoTerms)
    act(() => result.current.setRaw('changed'))
    expect(result.current.raw).toBe('changed')

    act(() => result.current.cancel())
    expect(result.current.raw).toBeNull()
  })

  it('saves an edited term against the version it opened, then closes and reports its name', async () => {
    const { result, onTermSaved } = await setup()
    act(() => result.current.startTerm(0, device))
    act(() => result.current.saveTerm({ ...device, definition: 'A smart meter.' }))
    await waitFor(() => expect(result.current.edit).toBeNull())
    expect(backend.lastSave).toEqual({
      markdown: updateTerm(twoTerms, 0, { ...device, definition: 'A smart meter.' }),
      baseVersion: 'v1',
    })
    expect(onTermSaved).toHaveBeenCalledWith('Device')
  })

  it('adds a new term', async () => {
    const { result } = await setup()
    act(() => result.current.startNew())
    act(() => result.current.saveTerm({ term: ' Meter ', definition: 'Counts energy.', avoid: '' }))
    await waitFor(() => expect(backend.lastSave?.markdown).toContain('**Meter**:\nCounts energy.'))
  })

  it('removes the open term, and only closes a new one', async () => {
    const { result } = await setup()
    act(() => result.current.startNew())
    act(() => result.current.removeTerm())
    expect(result.current.edit).toBeNull()
    expect(backend.saves).toEqual([])

    act(() => result.current.startTerm(1, site))
    act(() => result.current.removeTerm())
    await waitFor(() => expect(backend.lastSave?.markdown).toBe(removeTerm(twoTerms, 1)))
  })

  it('saves the whole markdown', async () => {
    const { result } = await setup()
    act(() => result.current.startRaw())
    act(() => result.current.setRaw('# Customer Portal\n'))
    act(() => result.current.saveRaw())
    await waitFor(() => expect(backend.lastSave).toEqual({ markdown: '# Customer Portal\n', baseVersion: 'v1' }))
    await waitFor(() => expect(result.current.raw).toBeNull())
  })

  it('keeps a refused term edit open and applies the next save to the same term in the latest Glossary', async () => {
    const { result } = await setup()
    act(() => result.current.startTerm(0, device))
    backend.current = { markdown: withAccount, version: 'v2' }
    act(() => result.current.saveTerm({ ...device, definition: 'A smart meter.' }))
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.edit).toMatchObject({ index: 1, name: 'Device' })
    expect(backend.saves).toEqual([])

    act(() => result.current.saveTerm({ ...device, definition: 'A smart meter.' }))
    await waitFor(() => expect(backend.lastSave?.baseVersion).toBe('v2'))
    expect(backend.lastSave?.markdown).toBe(updateTerm(withAccount, 1, { ...device, definition: 'A smart meter.' }))
  })

  it('saves a term removed meanwhile back as a new one', async () => {
    const { result } = await setup()
    act(() => result.current.startTerm(1, site))
    backend.current = { markdown: removeTerm(twoTerms, 1), version: 'v2' }
    act(() => result.current.saveTerm({ ...site, definition: 'A building.' }))
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.edit?.index).toBeNull()

    act(() => result.current.saveTerm({ ...site, definition: 'A building.' }))
    await waitFor(() => expect(backend.lastSave?.markdown).toContain('**Site**:\nA building.'))
  })

  it('keeps refused markdown and saves it over the latest Glossary next time', async () => {
    const { result } = await setup()
    act(() => result.current.startRaw())
    act(() => result.current.setRaw('mine'))
    backend.current = { markdown: withAccount, version: 'v2' }
    act(() => result.current.saveRaw())
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.raw).toBe('mine')

    act(() => result.current.saveRaw())
    await waitFor(() => expect(backend.lastSave).toEqual({ markdown: 'mine', baseVersion: 'v2' }))
  })

  it('says why a save failed and keeps the edit open', async () => {
    server.use(
      http.put(`*${endpoints.glossary('customer-portal')}`, () =>
        HttpResponse.json({ error: 'Disk full' }, { status: 500 }),
      ),
    )
    const { result } = await setup()
    act(() => result.current.startTerm(0, device))
    act(() => result.current.saveTerm(device))
    await waitFor(() => expect(result.current.failure).toBe('Disk full'))
    expect(result.current.edit).not.toBeNull()
    expect(result.current.stale).toBe(false)
  })

  it('follows the open term when a live update moves it, and loses its place when it is removed', async () => {
    const { result, queryClient } = await setup()
    const liveUpdate = (markdown: string, version: string) =>
      act(() => {
        queryClient.setQueryData(queryKeys.glossary('customer-portal'), { markdown, version })
      })
    act(() => result.current.startTerm(0, device))
    liveUpdate(withAccount, 'v2')
    await waitFor(() => expect(result.current.editingIndex).toBe(1))
    liveUpdate(removeTerm(twoTerms, 0), 'v3')
    await waitFor(() => expect(result.current.editingIndex).toBeNull())
    expect(result.current.edit).toMatchObject({ index: 0, name: 'Device' })
  })
})
