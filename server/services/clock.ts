// The one place the server reads the time, so every stored timestamp has the same ISO format.
import type { IterationMeta } from '#core/draft/draft.ts'

import { getSettings } from '../storage/settings.ts'

/** Length of the date part of an ISO timestamp: "2026-06-16". */
const ISO_DATE_LENGTH = 10

export const now = () => new Date().toISOString()
export const today = () => now().slice(0, ISO_DATE_LENGTH)

/** Date and author for an Iteration Log line: today, and the author from Settings. */
export const iterationMeta = async (): Promise<IterationMeta> => ({
  date: today(),
  author: (await getSettings()).author,
})
