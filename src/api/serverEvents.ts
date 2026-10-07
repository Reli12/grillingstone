// Turns the backend's websocket events into React Query cache updates, so every screen shows what
// the backend just saved without polling.
import type { QueryClient } from '@tanstack/react-query'

import {
  type ChatMessage,
  LIVE_STATUSES,
  type ServerEvent,
  type SessionSummary,
  type TemplateTranscript,
  type Transcript,
} from '#core/session/sessionTypes.ts'

import type { DraftWithSession } from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>

/** Replaces the message with the same id (a streamed message grows), or appends a new one. */
function upsertMessage(messages: ChatMessage[], message: ChatMessage) {
  const known = messages.some((existing) => existing.id === message.id)
  if (!known) return [...messages, message]
  return messages.map((existing) => (existing.id === message.id ? message : existing))
}

/** A live session becomes the Draft's live one; the live one ending clears it; others leave it alone. */
function liveSessionAfter(current: SessionSummary | null, session: SessionSummary, live: boolean) {
  if (live) return session
  if (current?.id === session.id) return null
  return current
}

function applyDraft(qc: QueryClient, event: EventOf<'draft'>) {
  qc.setQueryData<DraftWithSession>(queryKeys.draft(event.projectId, event.draft.id), (old) => ({
    draft: event.draft,
    liveSession: old?.liveSession ?? null,
  }))
  void qc.invalidateQueries({ queryKey: queryKeys.render(event.projectId, event.draft.id) })
}

function applySession(qc: QueryClient, event: EventOf<'session'>) {
  const { session } = event
  const live = LIVE_STATUSES.includes(session.status)
  qc.setQueryData<DraftWithSession>(queryKeys.draft(event.projectId, session.draftId), (old) => {
    if (!old) return old
    return { ...old, liveSession: liveSessionAfter(old.liveSession, session, live) }
  })
  qc.setQueryData<Transcript[]>(queryKeys.transcripts(event.projectId, session.draftId), (old) => {
    if (!old?.some((transcript) => transcript.id === session.id)) return old
    return old.map((transcript) => (transcript.id === session.id ? { ...transcript, ...session } : transcript))
  })
  // Once a session ends, refetch the Transcripts so the list matches what the backend saved.
  if (!live) void qc.invalidateQueries({ queryKey: queryKeys.transcripts(event.projectId, session.draftId) })
}

function applyTemplateSession(qc: QueryClient, event: EventOf<'templateSession'>) {
  const { session } = event
  const liveSession = LIVE_STATUSES.includes(session.status) ? session : null
  qc.setQueryData(queryKeys.liveTemplateSession, { session: liveSession })
  qc.setQueryData<TemplateTranscript>(queryKeys.templateSession(session.id), (old) =>
    old ? { ...old, ...session } : old,
  )
}

function applyTemplateMessage(qc: QueryClient, event: EventOf<'templateMessage'>) {
  qc.setQueryData<TemplateTranscript>(queryKeys.templateSession(event.sessionId), (old) => {
    if (!old) return old
    return { ...old, messages: upsertMessage(old.messages, event.message) }
  })
}

function applyMessage(qc: QueryClient, event: EventOf<'message'>) {
  const transcriptsKey = queryKeys.transcripts(event.projectId, event.draftId)
  qc.setQueryData<Transcript[]>(transcriptsKey, (old) => {
    if (!old) return old
    // A session not yet in the list: refetch the list rather than guess where it belongs.
    if (!old.some((transcript) => transcript.id === event.sessionId)) {
      void qc.invalidateQueries({ queryKey: transcriptsKey })
      return old
    }
    return old.map((transcript) => {
      if (transcript.id !== event.sessionId) return transcript
      return { ...transcript, messages: upsertMessage(transcript.messages, event.message) }
    })
  })
}

/** Folds one server event into the React Query cache: set what the event carries, invalidate the rest. */
export function applyServerEvent(qc: QueryClient, event: ServerEvent) {
  switch (event.type) {
    case 'draft':
      applyDraft(qc, event)
      break
    case 'drafts':
      void qc.invalidateQueries({ queryKey: queryKeys.drafts(event.projectId), exact: true })
      void qc.invalidateQueries({ queryKey: queryKeys.projects, exact: true })
      break
    case 'glossary':
      void qc.invalidateQueries({ queryKey: queryKeys.glossary(event.projectId) })
      break
    case 'templates':
      void qc.invalidateQueries({ queryKey: queryKeys.templates })
      break
    case 'session':
      applySession(qc, event)
      break
    case 'templateSession':
      applyTemplateSession(qc, event)
      break
    case 'templateMessage':
      applyTemplateMessage(qc, event)
      break
    case 'message':
      applyMessage(qc, event)
      break
  }
}
