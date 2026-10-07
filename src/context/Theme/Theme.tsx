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
    /* storage unavailable: the setting still applies for this page */
  }
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
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
