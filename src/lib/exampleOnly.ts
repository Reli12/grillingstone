// The live examples are real components; their actions only say so instead of reaching the Assistant.
import { toast } from 'sonner'

/** An example's action: says it would go to the named Assistant in a real session, and does nothing else. */
export const exampleOnly = (assistant: string) => () =>
  toast(`Example only — in a real session this goes to ${assistant}.`)
