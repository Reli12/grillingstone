// What the Draft sheet's Sections and Entries need from the page: human edits, Proposal decisions and
// starting a Focused Session ("Grill this").
import { createContext, useContext } from 'react'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import type { Change } from '#core/proposal/proposalTypes.ts'

export interface DraftEditorValue {
  draft: Draft
  pending: Change[]
  /** A session is running on this Draft — no new session can start. */
  sessionRunning: boolean
  busy: boolean
  apply: (op: HumanOp) => void
  decide: (changeId: string, accept: boolean) => void
  grill: (target: { sectionId: string; entryId?: string; heading: string }) => void
}

export const DraftEditorContext = createContext<DraftEditorValue | null>(null)

export function useDraftEditor() {
  const v = useContext(DraftEditorContext)
  if (!v) throw new Error('useDraftEditor outside DraftEditorContext')
  return v
}
