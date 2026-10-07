// The Theme setting as a three-way switch: System, Light or Dark.
import { Monitor, Moon, Sun } from 'lucide-react'

import { type Settings, type Theme, THEMES } from '#core/contract/apiTypes.ts'

import { useSaveSettings } from '@/api/hooks/projects/projectHooks'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { applyTheme } from '@/context/Theme/Theme'
import { cn } from '@/lib/cn'

const THEME_OPTIONS: Record<Theme, { label: string; icon: typeof Sun }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
}

interface ThemeChoiceProps {
  settings: Settings
}

/** Applies on click and saves at once — no Save button needed for a visual preference. */
export function ThemeChoice({ settings }: Readonly<ThemeChoiceProps>) {
  const save = useSaveSettings()
  const choose = (theme: Theme) => {
    applyTheme(theme)
    save.mutate({ ...settings, theme })
  }
  return (
    <fieldset>
      <FieldLabel hint="System follows your computer’s light or dark appearance. Saved with the tool’s settings.">
        Theme
      </FieldLabel>
      <div className="grid grid-cols-3 rounded-lg bg-fog-deep p-1" role="radiogroup" aria-label="Theme">
        {THEMES.map((theme) => {
          const { label, icon: Icon } = THEME_OPTIONS[theme]
          const on = settings.theme === theme
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(theme)}
              className={cn(
                'flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium',
                on ? 'bg-sheet text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
              )}
            >
              <Icon size={15} /> {label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
