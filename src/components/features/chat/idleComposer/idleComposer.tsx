// With no session running, typing starts a new one: a fresh first session before v1, otherwise a New
import type { Draft } from '#core/draft/draftTypes.ts'
import { type Transcript } from '#core/session/sessionTypes.ts'

import { NewSessionComposer } from '@/components/features/chat/newSessionComposer/newSessionComposer'
import { SESSION_TITLES } from '@/constants/SessionConstants'
import type { DraftMutations } from '@/hooks/draft/useDraftMutations'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import type { Continuing } from '@/types/chat'
import type { Continuable } from '@/types/draftPage'

const proposalOpenReason = (assistant: string) =>
  `Triage the Proposal in the Draft first — ${assistant} can have only one open at a time.`

/** "Focused Session on Scope", or just the session's title when it had no focus. */
function continuationLabel(transcript: Transcript) {
  const title = SESSION_TITLES[transcript.kind]
  if (!transcript.focus) return title
  return `${title} on ${transcript.focus.heading}`
}

/** The chosen Continuation as the message box shows it, with the way back to a new session. */
function continuingChoice(
  continueFrom: Transcript,
  onContinueFromChange: (transcript: Transcript | null) => void,
): Continuing {
  return { label: continuationLabel(continueFrom), onCancel: () => onContinueFromChange(null) }
}

/** What the idle message box says: continuing a session, re-grilling before v1, or a New Iteration after. */
function idleComposerText(assistant: string, continuing: boolean, beforeV1: boolean) {
  if (continuing)
    return {
      placeholder: `Tell ${assistant} why you are back…`,
      hint: `${assistant} remembers that conversation and gets the current Draft`,
    }
  if (beforeV1)
    return {
      placeholder: `Tell ${assistant} more to start grilling again…`,
      hint: 'Starts a new first session from your requirement',
    }
  return {
    placeholder: `Message ${assistant} to start a new session on the whole Draft…`,
    hint: 'Or press “Grill this” on a Section to focus on one part',
  }
}

export interface IdleComposerProps {
  draft: Draft
  latest?: Transcript
  mutations: DraftMutations
  continueFrom: Transcript | null
  onContinueFromChange: (transcript: Transcript | null) => void
  canContinue: (transcript: Continuable) => boolean
  onShowChat: () => void
}

/**
 * With no session running, typing starts a new one: a fresh first session before v1, otherwise a New
 * Iteration. Or it continues the ended session the human picked. Both begin from the current Draft.
 */
export function IdleComposer({
  draft,
  latest,
  mutations,
  continueFrom,
  onContinueFromChange,
  canContinue,
  onShowChat,
}: Readonly<IdleComposerProps>) {
  const { start, continueSession } = mutations
  // Only the Assistant in Settings can start or continue a session, so it is the one named here.
  const assistant = useAssistantLabel()
  const beforeV1 = draft.version === 0
  const startByTyping = (text: string) => {
    if (!continueFrom) {
      start.mutate({ kind: beforeV1 ? 'first' : 'iteration', humanNote: text }, { onSuccess: onShowChat })
      return
    }
    const onSuccess = () => {
      onContinueFromChange(null)
      onShowChat()
    }
    continueSession.mutate({ sessionId: continueFrom.id, humanNote: text }, { onSuccess })
  }
  const continuing = continueFrom ? continuingChoice(continueFrom, onContinueFromChange) : undefined
  const offerLatest = latest && canContinue(latest) ? () => onContinueFromChange(latest) : undefined
  const { placeholder, hint } = idleComposerText(assistant, !!continueFrom, beforeV1)
  return (
    <NewSessionComposer
      starting={start.isPending || continueSession.isPending}
      onStart={startByTyping}
      assistant={assistant}
      blockedReason={draft.proposal ? proposalOpenReason(assistant) : undefined}
      onContinueLatest={offerLatest}
      continuing={continuing}
      placeholder={placeholder}
      hint={hint}
    />
  )
}
