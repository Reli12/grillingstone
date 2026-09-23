import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { Settings } from '#core/contract/apiTypes.ts'
import { endpoints } from '@/api/endpoints/endpoints'
import SettingsPage from '@/pages/SettingsPage/SettingsPage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const captureSaves = () => {
  const saves: Settings[] = []
  server.use(
    http.put(`*${endpoints.settings}`, async ({ request }) => {
      saves.push((await request.json()) as Settings)
      return HttpResponse.json(saves.at(-1))
    }),
  )
  return saves
}

describe('SettingsPage', () => {
  it('applies and saves the theme at once', async () => {
    const saves = captureSaves()
    const { user } = render(<SettingsPage />)
    await user.click(await screen.findByRole('radio', { name: /Dark/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('pbi.theme')).toBe('dark')
    await vi.waitFor(() => expect(saves).toEqual([{ author: 'dorijan', model: '', theme: 'dark' }]))
  })

  it('saves author and model', async () => {
    const saves = captureSaves()
    const { user } = render(<SettingsPage />)
    const save = await screen.findByRole('button', { name: 'Save settings' })
    expect(save).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /Model for Grilling Sessions/ }), ' opus ')
    await user.click(save)
    await vi.waitFor(() => expect(saves).toEqual([{ author: 'dorijan', model: 'opus', theme: 'system' }]))
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument()
  })

  it('needs an author name', async () => {
    const { user } = render(<SettingsPage />)
    await user.clear(await screen.findByRole('textbox', { name: /Your name/ }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText(/Used in Iteration Log lines/)).toBeInTheDocument()
  })
})
