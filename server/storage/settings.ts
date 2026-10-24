// The human's Settings (author, Claude model, theme, Default Tracker) in data/settings.json. Reads and saves both clean the
// values, so a hand-edited or missing file still yields usable Settings.
import { type Settings, THEMES } from '#core/contract/apiTypes.ts'
import { trackerOrDefault } from '#core/shared/tracker.ts'

import { DEFAULT_AUTHOR } from '../config.ts'
import { readJson, writeJson } from './fsUtil.ts'
import { settingsFile } from './paths.ts'

type Theme = Settings['theme']

const DEFAULT_THEME: Theme = 'system'

/** A leading "@" typed before a handle; the author is stored as the bare name. */
const LEADING_AT = /^@/

const theme = (value: unknown): Theme => (THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME)

export async function getSettings(): Promise<Settings> {
  const stored = await readJson<Partial<Settings>>(settingsFile)
  return {
    author: stored?.author?.trim() || DEFAULT_AUTHOR,
    model: stored?.model?.trim() ?? '',
    theme: theme(stored?.theme),
    defaultTracker: trackerOrDefault(stored?.defaultTracker),
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const clean: Settings = {
    author: settings.author.trim().replace(LEADING_AT, '') || DEFAULT_AUTHOR,
    model: settings.model.trim(),
    theme: theme(settings.theme),
    defaultTracker: trackerOrDefault(settings.defaultTracker),
  }
  await writeJson(settingsFile, clean)
  return clean
}
