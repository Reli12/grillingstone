// Tests for ThemeProvider: the saved theme is applied and cached, even without storage.
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import { applyTheme, THEME_STORAGE_KEY, ThemeProvider } from '@/context/Theme/Theme'
import { settingsFixture } from '@test/mocks/handlers'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

describe('ThemeProvider', () => {
  it('applies the saved theme and keeps a copy for the next page load', async () => {
    server.use(http.get(`*${endpoints.settings}`, () => HttpResponse.json({ ...settingsFixture, theme: 'light' })))
    render(
      <ThemeProvider>
        <p>app</p>
      </ThemeProvider>,
    )
    expect(screen.getByText('app')).toBeInTheDocument()
    await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('still applies the theme when storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    setItem.mockRestore()
  })
})
