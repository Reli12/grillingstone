// Display names for each kind of session, and what each one writes.
import type { SessionBase } from '#core/session/sessionTypes.ts'

export const SESSION_TITLES = {
  first: 'First session',
  focused: 'Focused Session',
  iteration: 'New Iteration',
  upgrade: 'Template upgrade',
  template: 'Template Session',
} as const

/** What the Ready Check offers to write. */
export const writeTarget = (kind: SessionBase['kind']) => {
  if (kind === 'first') return 'the Draft'
  if (kind === 'template') return 'the Template'
  // Every later session proposes changes instead of overwriting the Draft.
  return 'the Proposal'
}
