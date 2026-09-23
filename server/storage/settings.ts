import { THEMES, type Settings } from '#core/contract/apiTypes.ts'
import { DEFAULT_AUTHOR } from '../config.ts'
import { readJson, writeJson } from './fsUtil.ts'
import { settingsFile } from './paths.ts'

const theme = (t: unknown): Settings['theme'] => (THEMES.includes(t as Settings['theme']) ? (t as Settings['theme']) : 'system')

export async function getSettings(): Promise<Settings> {
  const s = await readJson<Partial<Settings>>(settingsFile)
  return { author: s?.author?.trim() || DEFAULT_AUTHOR, model: s?.model?.trim() ?? '', theme: theme(s?.theme) }
}

export async function saveSettings(s: Settings): Promise<Settings> {
  const clean: Settings = { author: s.author.trim().replace(/^@/, '') || DEFAULT_AUTHOR, model: s.model.trim(), theme: theme(s.theme) }
  await writeJson(settingsFile, clean)
  return clean
}
