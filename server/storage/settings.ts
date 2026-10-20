// The human's Settings (author, Assistant, a model per Assistant, theme) in data/settings.json. Reads and saves
// both clean the values, so a hand-edited, missing or older file still yields usable Settings.
import type { Settings } from '#core/contract/apiTypes.ts'
import { THEMES } from '#core/contract/apiTypes.ts'
import { ASSISTANT_NAMES, type AssistantName, DEFAULT_ASSISTANT } from '#core/session/assistantName.ts'

import { DEFAULT_AUTHOR } from '../config.ts'
import { readJson, writeJson } from './fsUtil.ts'
import { settingsFile } from './paths.ts'

type Theme = Settings['theme']

const DEFAULT_THEME: Theme = 'system'

/** A leading "@" typed before a handle; the author is stored as the bare name. */
const LEADING_AT = /^@/

/** What settings.json may hold: today's fields, or the single Claude `model` from before the Assistant choice. */
type StoredSettings = Partial<Settings> & { model?: string }

const theme = (value: unknown): Theme => (THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME)
const assistant = (value: unknown): AssistantName =>
  ASSISTANT_NAMES.includes(value as AssistantName) ? (value as AssistantName) : DEFAULT_ASSISTANT
const model = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

function models(stored: StoredSettings): Settings['models'] {
  const given = stored.models ?? { claude: stored.model, codex: '' }
  return { claude: model(given.claude), codex: model(given.codex) }
}

/** Whether the human has saved Settings yet; before that, a first run may pick the Assistant that is installed. */
export async function hasSavedSettings(): Promise<boolean> {
  return (await readJson<StoredSettings>(settingsFile)) !== null
}

export async function getSettings(): Promise<Settings> {
  const stored = (await readJson<StoredSettings>(settingsFile)) ?? {}
  return {
    author: stored.author?.trim() || DEFAULT_AUTHOR,
    assistant: assistant(stored.assistant),
    models: models(stored),
    theme: theme(stored.theme),
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const clean: Settings = {
    author: settings.author.trim().replace(LEADING_AT, '') || DEFAULT_AUTHOR,
    assistant: assistant(settings.assistant),
    models: models(settings),
    theme: theme(settings.theme),
  }
  await writeJson(settingsFile, clean)
  return clean
}
