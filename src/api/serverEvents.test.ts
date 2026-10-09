// Tests for applyServerEvent: each server event type lands in, or invalidates, the right cache entry.
import { type QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import type { ChatMessage, TemplateTranscript, Transcript } from '#core/session/sessionTypes.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

import type { DraftWithSession } from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'
import { applyServerEvent } from '@/api/serverEvents'
import { liveSession } from '@test/mocks/draftBackend'
import { createTestQueryClient } from '@test/utils/testUtils'

const draft = v1Draft()
const projectId = draft.projectId
const msg = (id: string, text = 'hi'): ChatMessage => ({ id, at: '', role: 'system', text })
const invalidated = (qc: ReturnType<typeof createTestQueryClient>, key: readonly unknown[]) =>
  qc.getQueryState(key)?.isInvalidated

const templateSession = {
  id: 'ts',
  kind: 'template' as const,
  status: 'waiting' as const,
  writeConfirmed: false,
  startedAt: '',
  request: { workItemType: 'PBI' as const, purpose: 'x', examples: '' },
}

/**
 * A screen loading `queryKey` whose first load is still in flight when the event arrives: that load would answer
 * with what the backend held just before the event, so it never answers here; any later load returns `fresh`.
 * Returns the function that stops the screen watching.
 */
function loadingWhenEventArrives<T>(qc: QueryClient, queryKey: readonly unknown[], fresh: T) {
  const staleLoad = new Promise<T>(() => {})
  const loads = [staleLoad]
  const observer = new QueryObserver(qc, { queryKey, queryFn: () => loads.shift() ?? Promise.resolve(fresh) })
  return observer.subscribe(() => {})
}

function seeded() {
  const qc = createTestQueryClient()
  for (const key of [
    queryKeys.render(projectId, draft.id),
    queryKeys.drafts(projectId),
    queryKeys.projects,
    queryKeys.glossary(projectId),
    queryKeys.templates,
  ])
    qc.setQueryData(key, {})
  return qc
}

describe('applyServerEvent', () => {
  it('puts a saved Draft into the cache and keeps the live session', () => {
    const qc = seeded()
    const live = liveSession(draft)
    qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id), { draft, liveSession: live })
    const next = { ...draft, version: 2 }
    applyServerEvent(qc, { type: 'draft', projectId, draft: next })
    expect(qc.getQueryData(queryKeys.draft(projectId, draft.id))).toEqual({ draft: next, liveSession: live })
    expect(invalidated(qc, queryKeys.render(projectId, draft.id))).toBe(true)
  })

  it('invalidates lists, Glossary and Templates', () => {
    const qc = seeded()
    applyServerEvent(qc, { type: 'drafts', projectId })
    applyServerEvent(qc, { type: 'glossary', projectId })
    applyServerEvent(qc, { type: 'templates' })
    for (const key of [
      queryKeys.drafts(projectId),
      queryKeys.projects,
      queryKeys.glossary(projectId),
      queryKeys.templates,
    ])
      expect(invalidated(qc, key)).toBe(true)
  })

  it('tracks a session starting and ending on its Draft and Transcript', () => {
    const qc = seeded()
    const live = liveSession(draft, { status: 'thinking' })
    qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id), { draft, liveSession: null })
    qc.setQueryData<Transcript[]>(queryKeys.transcripts(projectId, draft.id), [{ ...live, messages: [] }])

    applyServerEvent(qc, { type: 'session', projectId, session: live })
    expect(qc.getQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id))?.liveSession).toEqual(live)

    applyServerEvent(qc, { type: 'session', projectId, session: { ...live, status: 'finished' } })
    expect(qc.getQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id))?.liveSession).toBeNull()
    expect(qc.getQueryData<Transcript[]>(queryKeys.transcripts(projectId, draft.id))?.[0].status).toBe('finished')
    expect(invalidated(qc, queryKeys.transcripts(projectId, draft.id))).toBe(true)
  })

  it('leaves an unknown session and uncached data alone', () => {
    const qc = seeded()
    const other = liveSession(draft, { id: 'other' })
    qc.setQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id), { draft, liveSession: liveSession(draft) })
    qc.setQueryData<Transcript[]>(queryKeys.transcripts(projectId, draft.id), [])
    applyServerEvent(qc, { type: 'session', projectId, session: { ...other, status: 'stopped' } })
    expect(qc.getQueryData<DraftWithSession>(queryKeys.draft(projectId, draft.id))?.liveSession?.id).toBe('sess-live')
    expect(qc.getQueryData(queryKeys.transcripts(projectId, draft.id))).toEqual([])
  })

  it('appends and replaces chat messages', () => {
    const qc = seeded()
    const transcript: Transcript = { ...liveSession(draft), messages: [msg('a')] }
    qc.setQueryData<Transcript[]>(queryKeys.transcripts(projectId, draft.id), [transcript])
    applyServerEvent(qc, { type: 'message', projectId, draftId: draft.id, sessionId: transcript.id, message: msg('b') })
    applyServerEvent(qc, {
      type: 'message',
      projectId,
      draftId: draft.id,
      sessionId: transcript.id,
      message: msg('a', 'edited'),
    })
    expect(qc.getQueryData<Transcript[]>(queryKeys.transcripts(projectId, draft.id))?.[0].messages).toEqual([
      msg('a', 'edited'),
      msg('b'),
    ])

    // A message for a session not yet in the list: refetch the list rather than guess its place.
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    applyServerEvent(qc, { type: 'message', projectId, draftId: draft.id, sessionId: 'new', message: msg('c') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.transcripts(projectId, draft.id) })
  })

  it('follows a Template Session', () => {
    const qc = seeded()
    const session = templateSession
    qc.setQueryData<TemplateTranscript>(queryKeys.templateSession('ts'), { ...session, messages: [msg('a')] })

    applyServerEvent(qc, { type: 'templateSession', session })
    expect(qc.getQueryData(queryKeys.liveTemplateSession)).toEqual({ session })
    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'ts', message: msg('b') })
    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'ts', message: msg('a', 'edited') })
    applyServerEvent(qc, { type: 'templateSession', session: { ...session, status: 'finished', templateId: 't1' } })

    expect(qc.getQueryData(queryKeys.liveTemplateSession)).toEqual({ session: null })
    expect(qc.getQueryData<TemplateTranscript>(queryKeys.templateSession('ts'))).toMatchObject({
      status: 'finished',
      templateId: 't1',
      messages: [msg('a', 'edited'), msg('b')],
    })
    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'unknown', message: msg('x') })
    expect(qc.getQueryData(queryKeys.templateSession('unknown'))).toBeUndefined()
  })
  it('keeps a Template Session event that arrives while its Transcript is still loading', async () => {
    const qc = createTestQueryClient()
    const queryKey = queryKeys.templateSession('ts')
    const question = msg('q', 'Who may archive?')
    const stopWatching = loadingWhenEventArrives(qc, queryKey, { ...templateSession, messages: [question] })

    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'ts', message: question })

    await vi.waitFor(() => expect(qc.getQueryData<TemplateTranscript>(queryKey)?.messages).toEqual([question]))
    stopWatching()
  })

  it("keeps a chat message that arrives while the Draft's Transcripts are still loading", async () => {
    const qc = createTestQueryClient()
    const queryKey = queryKeys.transcripts(projectId, draft.id)
    const live = liveSession(draft)
    const question = msg('q', 'Who may archive?')
    const stopWatching = loadingWhenEventArrives(qc, queryKey, [{ ...live, messages: [question] }])

    applyServerEvent(qc, { type: 'message', projectId, draftId: draft.id, sessionId: live.id, message: question })

    await vi.waitFor(() => expect(qc.getQueryData<Transcript[]>(queryKey)?.[0].messages).toEqual([question]))
    stopWatching()
  })
  it('keeps a session that starts while its Draft is still loading', async () => {
    const qc = createTestQueryClient()
    const queryKey = queryKeys.draft(projectId, draft.id)
    const live = liveSession(draft, { status: 'thinking' })
    const stopWatching = loadingWhenEventArrives<DraftWithSession>(qc, queryKey, { draft, liveSession: live })

    applyServerEvent(qc, { type: 'session', projectId, session: live })

    await vi.waitFor(() => expect(qc.getQueryData<DraftWithSession>(queryKey)?.liveSession).toEqual(live))
    stopWatching()
  })
  it("keeps a session's new status that arrives while the Draft's Transcripts are still loading", async () => {
    const qc = createTestQueryClient()
    const queryKey = queryKeys.transcripts(projectId, draft.id)
    const waiting = liveSession(draft, { status: 'waiting' })
    const stopWatching = loadingWhenEventArrives<Transcript[]>(qc, queryKey, [{ ...waiting, messages: [] }])

    applyServerEvent(qc, { type: 'session', projectId, session: waiting })

    await vi.waitFor(() => expect(qc.getQueryData<Transcript[]>(queryKey)?.[0].status).toBe('waiting'))
    stopWatching()
  })
})
