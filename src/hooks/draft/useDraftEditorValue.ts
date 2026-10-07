// What the Draft sheet's Sections and Entries get through DraftEditorContext.
import { useMemo } from 'react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { type SessionSummary } from '#core/session/sessionTypes.ts'

import { type StartIntent } from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import { type DraftEditorValue } from '@/context/DraftEditor/DraftEditor'
import type { DraftMutations } from '@/hooks/draft/useDraftMutations'

/** What the Draft sheet's Sections and Entries get through DraftEditorContext. */
export function useDraftEditorValue(
  draft: Draft | undefined,
  live: SessionSummary | undefined,
  mutations: DraftMutations,
  onGrill: (intent: StartIntent) => void,
) {
  const { op, decide, acceptClean } = mutations
  const busy = op.isPending || decide.isPending || acceptClean.isPending
  return useMemo<DraftEditorValue | null>(
    () =>
      draft
        ? {
            draft,
            pending: draft.proposal?.changes.filter((change) => change.status === 'pending') ?? [],
            sessionRunning: !!live,
            busy,
            apply: (humanOp) => op.mutate(humanOp),
            decide: (changeId, accept) => decide.mutate({ changeId, accept }),
            grill: (target) => onGrill({ kind: 'focused', ...target }),
          }
        : null,
    [draft, live, busy, op, decide, onGrill],
  )
}
