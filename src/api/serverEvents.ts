import type { QueryClient } from '@tanstack/react-query'

import {
  LIVE_STATUSES,
  type ServerEvent,
  type TemplateTranscript,
  type Transcript,
} from '#core/session/sessionTypes.ts'

import type { DraftWithSession } from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'

/** Folds one server event into the React Query cache: set what the event carries, invalidate the rest. */
export function applyServerEvent(qc: QueryClient, e: ServerEvent) {
  switch (e.type) {
    case 'draft':
      qc.setQueryData<DraftWithSession>(queryKeys.draft(e.projectId, e.draft.id), (old) => ({
        draft: e.draft,
        liveSession: old?.liveSession ?? null,
      }))
      void qc.invalidateQueries({ queryKey: queryKeys.render(e.projectId, e.draft.id) })
      break
    case 'drafts':
      void qc.invalidateQueries({ queryKey: queryKeys.drafts(e.projectId), exact: true })
      void qc.invalidateQueries({ queryKey: queryKeys.projects, exact: true })
      break
    case 'glossary':
      void qc.invalidateQueries({ queryKey: queryKeys.glossary(e.projectId) })
      break
    case 'templates':
      void qc.invalidateQueries({ queryKey: queryKeys.templates })
      break
    case 'session': {
      const s = e.session
      const live = LIVE_STATUSES.includes(s.status)
      qc.setQueryData<DraftWithSession>(queryKeys.draft(e.projectId, s.draftId), (old) =>
        old ? { ...old, liveSession: live ? s : old.liveSession?.id === s.id ? null : old.liveSession } : old,
      )
      qc.setQueryData<Transcript[]>(queryKeys.transcripts(e.projectId, s.draftId), (old) => {
        if (!old) return old
        return old.some((t) => t.id === s.id) ? old.map((t) => (t.id === s.id ? { ...t, ...s } : t)) : old
      })
      if (!live) void qc.invalidateQueries({ queryKey: queryKeys.transcripts(e.projectId, s.draftId) })
      break
    }
    case 'templateSession': {
      const s = e.session
      qc.setQueryData(queryKeys.liveTemplateSession, { session: LIVE_STATUSES.includes(s.status) ? s : null })
      qc.setQueryData<TemplateTranscript>(queryKeys.templateSession(s.id), (old) => (old ? { ...old, ...s } : old))
      break
    }
    case 'templateMessage':
      qc.setQueryData<TemplateTranscript>(queryKeys.templateSession(e.sessionId), (old) => {
        if (!old) return old
        const has = old.messages.some((m) => m.id === e.message.id)
        return {
          ...old,
          messages: has
            ? old.messages.map((m) => (m.id === e.message.id ? e.message : m))
            : [...old.messages, e.message],
        }
      })
      break
    case 'message':
      qc.setQueryData<Transcript[]>(queryKeys.transcripts(e.projectId, e.draftId), (old) => {
        if (!old) return old
        if (!old.some((t) => t.id === e.sessionId)) {
          void qc.invalidateQueries({ queryKey: queryKeys.transcripts(e.projectId, e.draftId) })
          return old
        }
        return old.map((t) => {
          if (t.id !== e.sessionId) return t
          const has = t.messages.some((m) => m.id === e.message.id)
          return {
            ...t,
            messages: has ? t.messages.map((m) => (m.id === e.message.id ? e.message : m)) : [...t.messages, e.message],
          }
        })
      })
      break
  }
}
