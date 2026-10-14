// Tests for useCheckedGlossarySave: a save against the version an edit started from, and what a caller hears back.
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import { useCheckedGlossarySave } from '@/hooks/glossary/useCheckedGlossarySave'
import { type GlossaryBackend, glossaryBackend } from '@test/mocks/glossaryBackend'
import { server } from '@test/mocks/server'
import { renderHook } from '@test/utils/testUtils'

const base = { markdown: '# Portal\n', version: 'v1' }
let backend: GlossaryBackend

const outcome = () => ({ onSaved: vi.fn(), onRefused: vi.fn(), onFailed: vi.fn() })

describe('useCheckedGlossarySave', () => {
  beforeEach(() => {
    backend = glossaryBackend('portal', base.markdown)
  })

  it('saves against the given version and reports success', async () => {
    const { result } = renderHook(() => useCheckedGlossarySave('portal'))
    const calls = outcome()
    act(() => result.current.saveChecked(base, '# Portal\n\nMore.\n', calls))
    await waitFor(() => expect(calls.onSaved).toHaveBeenCalledOnce())
    expect(backend.lastSave).toEqual({ markdown: '# Portal\n\nMore.\n', baseVersion: 'v1' })
    expect(calls.onRefused).not.toHaveBeenCalled()
  })

  it('is saving while the request is in flight', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.put(`*${endpoints.glossary('portal')}`, async () => {
        await held
        return HttpResponse.json(base)
      }),
    )
    const { result } = renderHook(() => useCheckedGlossarySave('portal'))
    expect(result.current.saving).toBe(false)
    act(() => result.current.saveChecked(base, 'x', outcome()))
    await waitFor(() => expect(result.current.saving).toBe(true))
    release()
    await waitFor(() => expect(result.current.saving).toBe(false))
  })

  it('hands back the latest Glossary when the save is refused as stale, fetching it once', async () => {
    let fetches = 0
    server.use(
      http.get(`*${endpoints.glossary('portal')}`, () => {
        fetches++
        return HttpResponse.json(backend.current)
      }),
    )
    const { result } = renderHook(() => useCheckedGlossarySave('portal'))
    await waitFor(() => expect(fetches).toBe(1))
    fetches = 0
    backend.current = { markdown: '# Portal\n\nClaude wrote this.\n', version: 'v2' }
    const calls = outcome()
    act(() => result.current.saveChecked(base, 'mine', calls))
    await waitFor(() => expect(calls.onRefused).toHaveBeenCalledWith(backend.current))
    expect(fetches).toBe(1)
    expect(backend.saves).toEqual([])
  })

  it('reports any other failure with its reason', async () => {
    server.use(
      http.put(`*${endpoints.glossary('portal')}`, () => HttpResponse.json({ error: 'Disk full' }, { status: 500 })),
    )
    const { result } = renderHook(() => useCheckedGlossarySave('portal'))
    const calls = outcome()
    act(() => result.current.saveChecked(base, 'mine', calls))
    await waitFor(() => expect(calls.onFailed).toHaveBeenCalledWith('Disk full'))
    expect(calls.onRefused).not.toHaveBeenCalled()
  })
})
