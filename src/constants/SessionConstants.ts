import type { SessionBase } from '#core/session/sessionTypes.ts'

export const SESSION_TITLES = {
  first: 'First session',
  focused: 'Focused Session',
  iteration: 'New Iteration',
  upgrade: 'Template upgrade',
  template: 'Template Session',
} as const

/** What the Ready Check offers to write. */
export const writeTarget = (kind: SessionBase['kind']) => (kind === 'first' ? 'the Draft' : kind === 'template' ? 'the Template' : 'the Proposal')
