// Applies the Theme setting (data/settings.json) to <html data-theme>. index.css maps it to
// `color-scheme`, which every light-dark() colour follows. A copy in localStorage lets index.html
// paint the right theme before the settings have loaded.
import { type ReactNode, useEffect } from 'react'

import { Toaster } from 'sonner'

import type { Theme } from '#core/contract/apiTypes.ts'

import { useSettings } from '@/api/hooks/projects/projectHooks'

export const THEME_STORAGE_KEY = 'pbi.theme'

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked; the theme still applies to this page, only the early paint on reload is lost.
  }
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: Readonly<ThemeProviderProps>) {
  const { data } = useSettings()
  useEffect(() => {
    if (data) applyTheme(data.theme)
  }, [data])
  return (
    <>
      {children}
      <Toaster position="bottom-left" theme={data?.theme ?? 'system'} toastOptions={{ className: 'font-sans' }} />
    </>
  )
}
