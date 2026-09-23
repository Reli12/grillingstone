import type { IterationMeta } from '#core/draft/draft.ts'
import { getSettings } from '../storage/settings.ts'

export const now = () => new Date().toISOString()
export const today = () => now().slice(0, 10)

/** Date and author for an Iteration Log line: today, and the author from Settings. */
export const iterationMeta = async (): Promise<IterationMeta> => ({ date: today(), author: (await getSettings()).author })
