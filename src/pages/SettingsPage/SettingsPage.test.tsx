// Tests for SettingsPage: the theme and the Assistant apply at once; author and each Assistant's model save, and
// author is required.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { Settings, SettingsView } from '#core/contract/apiTypes.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import SettingsPage from '@/pages/SettingsPage/SettingsPage'
import { settingsFixture } from '@test/mocks/handlers'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const captureSaves = () => {
  const saves: Settings[] = []
  server.use(
    http.put(`*${endpoints.settings}`, async ({ request }) => {
      saves.push((await request.json()) as Settings)
      return HttpResponse.json({ ...saves.at(-1), availability: settingsFixture.availability })
    }),
  )
  return saves
}

const serveSettings = (patch: Partial<SettingsView>) =>
  server.use(http.get(`*${endpoints.settings}`, () => HttpResponse.json({ ...settingsFixture, ...patch })))

describe('SettingsPage', () => {
  it('applies and saves the theme at once', async () => {
    const saves = captureSaves()
    const { user } = render(<SettingsPage />)
    await user.click(await screen.findByRole('radio', { name: /Dark/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('pbi.theme')).toBe('dark')
    await vi.waitFor(() =>
      expect(saves).toEqual([
        { author: 'dorijan', assistant: 'claude', models: { claude: '', codex: '' }, theme: 'dark' },
      ]),
    )
  })

  it('chooses the Assistant at once, showing whether each one can run and how to fix it', async () => {
    serveSettings({
      availability: {
        claude: { ready: true },
        codex: { ready: false, fix: 'Codex isn’t signed in. Run `codex login` in a terminal, then try again.' },
      },
    })
    const saves = captureSaves()
    const { user } = render(<SettingsPage />)
    const codex = await screen.findByRole('radio', { name: /Codex/ })
    expect(screen.getByRole('radio', { name: /Claude/ })).toBeChecked()
    expect(screen.getByText(/Codex isn’t signed in/)).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()

    await user.click(codex)
    await vi.waitFor(() => expect(saves).toEqual([expect.objectContaining({ assistant: 'codex' })]))
  })

  it('keeps a model per Assistant, editing the chosen one’s', async () => {
    serveSettings({ assistant: 'codex', models: { claude: 'opus', codex: '' } })
    const saves = captureSaves()
    const { user } = render(<SettingsPage />)
    await user.type(await screen.findByRole('textbox', { name: /Model for Codex/ }), 'o4')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await vi.waitFor(() =>
      expect(saves).toEqual([expect.objectContaining({ models: { claude: 'opus', codex: 'o4' } })]),
    )
  })

  it('saves author and model', async () => {
    const saves = captureSaves()
    const { user } = render(<SettingsPage />)
    const save = await screen.findByRole('button', { name: 'Save settings' })
    expect(save).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /Model for Claude/ }), ' opus ')
    await user.click(save)
    await vi.waitFor(() =>
      expect(saves).toEqual([
        { author: 'dorijan', assistant: 'claude', models: { claude: 'opus', codex: '' }, theme: 'system' },
      ]),
    )
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument()
  })

  it('needs an author name', async () => {
    const { user } = render(<SettingsPage />)
    await user.clear(await screen.findByRole('textbox', { name: /Your name/ }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText(/Used in Iteration Log lines/)).toBeInTheDocument()
  })
})
