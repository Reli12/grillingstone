// What the Draft sheet's Sections and Entries get through DraftEditorContext.
import { useMemo } from 'react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { ASSISTANT_LABELS } from '#core/session/assistantName.ts'
import { type SessionSummary, type Transcript } from '#core/session/sessionTypes.ts'

import { type StartIntent } from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import { type DraftEditorValue } from '@/context/DraftEditor/DraftEditor'
import type { DraftMutations } from '@/hooks/draft/useDraftMutations'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

/** What the Draft sheet's Sections and Entries get through DraftEditorContext. */
export function useDraftEditorValue(
  draft: Draft | undefined,
  live: SessionSummary | undefined,
  transcripts: Transcript[] | undefined,
  mutations: DraftMutations,
  onGrill: (intent: StartIntent) => void,
) {
  const { op, decide, acceptClean } = mutations
  const busy = op.isPending || decide.isPending || acceptClean.isPending
  // A Proposal names the Assistant whose session wrote it; Settings stand in until the Transcripts load.
  const chosenAssistant = useAssistantLabel()
  const proposalSession = transcripts?.find((transcript) => transcript.id === draft?.proposal?.sessionId)
  const proposalAssistant = proposalSession ? ASSISTANT_LABELS[proposalSession.assistant] : chosenAssistant
  return useMemo<DraftEditorValue | null>(
    () =>
      draft
        ? {
            draft,
            pending: draft.proposal?.changes.filter((change) => change.status === 'pending') ?? [],
            sessionRunning: !!live,
            busy,
            proposalAssistant,
            apply: (humanOp) => op.mutate(humanOp),
            decide: (changeId, accept) => decide.mutate({ changeId, accept }),
            grill: (target) => onGrill({ kind: 'focused', ...target }),
          }
        : null,
    [draft, live, busy, proposalAssistant, op, decide, onGrill],
  )
}
