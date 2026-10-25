// With no session running, typing starts a new one: a fresh first session before v1, otherwise a New
import type { Draft } from '#core/draft/draftTypes.ts'
import type { ImageUpload } from '#core/session/images.ts'
import { type SessionSummary, type Transcript } from '#core/session/sessionTypes.ts'

import { NewSessionComposer } from '@/components/features/chat/newSessionComposer/newSessionComposer'
import { SESSION_TITLES } from '@/constants/SessionConstants'
import type { OnStarted } from '@/hooks/chat/useStartForm'
import type { DraftMutations } from '@/hooks/draft/useDraftMutations'
import type { Continuable } from '@/types/draftPage'

const PROPOSAL_OPEN_REASON = 'Triage the Proposal in the Draft first — Claude can have only one open at a time.'

/** "Focused Session on Scope", or just the session's title when it had no focus. */
function continuationLabel(transcript: Transcript) {
  const title = SESSION_TITLES[transcript.kind]
  if (!transcript.focus) return title
  return `${title} on ${transcript.focus.heading}`
}

/** What the idle message box says: continuing a session, re-grilling before v1, or a New Iteration after. */
function idleComposerText(continuing: boolean, beforeV1: boolean) {
  if (continuing)
    return {
      placeholder: 'Tell Claude why you are back…',
      hint: 'Claude remembers that conversation and gets the current Draft',
    }
  if (beforeV1)
    return {
      placeholder: 'Tell Claude more to start grilling again…',
      hint: 'Starts a new first session from your requirement',
    }
  return {
    placeholder: 'Message Claude to start a new session on the whole Draft…',
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
  const beforeV1 = draft.version === 0
  const startByTyping = (text: string, images: ImageUpload[], onStarted: OnStarted) => {
    if (!continueFrom) {
      // The images key is left out when there are none, so a text-only start is the request it always was.
      const withImages = images.length ? { images } : {}
      const kind = beforeV1 ? 'first' : 'iteration'
      const onSuccess = (session: SessionSummary) => {
        onStarted(session.id)
        onShowChat()
      }
      start.mutate({ kind, humanNote: text, ...withImages }, { onSuccess })
      return
    }
    const onSuccess = () => {
      onContinueFromChange(null)
      onShowChat()
    }
    continueSession.mutate({ sessionId: continueFrom.id, humanNote: text }, { onSuccess })
  }
  const continuing = continueFrom
    ? { label: continuationLabel(continueFrom), onCancel: () => onContinueFromChange(null) }
    : undefined
  const offerLatest = latest && canContinue(latest) ? () => onContinueFromChange(latest) : undefined
  const { placeholder, hint } = idleComposerText(!!continueFrom, beforeV1)
  return (
    <NewSessionComposer
      starting={start.isPending || continueSession.isPending}
      onStart={startByTyping}
      sessionKey={`new-session:${draft.id}`}
      blockedReason={draft.proposal ? PROPOSAL_OPEN_REASON : undefined}
      onContinueLatest={offerLatest}
      continuing={continuing}
      placeholder={placeholder}
      hint={hint}
    />
  )
}
