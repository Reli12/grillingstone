import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage, TemplateTranscript, Transcript } from '#core/session/sessionTypes.ts'
import { v1Draft } from '#core/testing/fixtures.ts'
import type { DraftWithSession } from '@/api/draftsApi'
import { queryKeys } from '@/api/reactQueryKeys'
import { applyServerEvent } from '@/api/serverEvents'
import { liveSession } from '@test/mocks/draftBackend'
import { createTestQueryClient } from '@test/utils/testUtils'

const draft = v1Draft()
const P = draft.projectId
const msg = (id: string, text = 'hi'): ChatMessage => ({ id, at: '', role: 'system', text })
const invalidated = (qc: ReturnType<typeof createTestQueryClient>, key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated

function seeded() {
  const qc = createTestQueryClient()
  for (const key of [queryKeys.render(P, draft.id), queryKeys.drafts(P), queryKeys.projects, queryKeys.glossary(P), queryKeys.templates]) qc.setQueryData(key, {})
  return qc
}

describe('applyServerEvent', () => {
  it('puts a saved Draft into the cache and keeps the live session', () => {
    const qc = seeded()
    const live = liveSession(draft)
    qc.setQueryData<DraftWithSession>(queryKeys.draft(P, draft.id), { draft, liveSession: live })
    const next = { ...draft, version: 2 }
    applyServerEvent(qc, { type: 'draft', projectId: P, draft: next })
    expect(qc.getQueryData(queryKeys.draft(P, draft.id))).toEqual({ draft: next, liveSession: live })
    expect(invalidated(qc, queryKeys.render(P, draft.id))).toBe(true)
  })

  it('invalidates lists, Glossary and Templates', () => {
    const qc = seeded()
    applyServerEvent(qc, { type: 'drafts', projectId: P })
    applyServerEvent(qc, { type: 'glossary', projectId: P })
    applyServerEvent(qc, { type: 'templates' })
    for (const key of [queryKeys.drafts(P), queryKeys.projects, queryKeys.glossary(P), queryKeys.templates]) expect(invalidated(qc, key)).toBe(true)
  })

  it('tracks a session starting and ending on its Draft and Transcript', () => {
    const qc = seeded()
    const live = liveSession(draft, { status: 'thinking' })
    qc.setQueryData<DraftWithSession>(queryKeys.draft(P, draft.id), { draft, liveSession: null })
    qc.setQueryData<Transcript[]>(queryKeys.transcripts(P, draft.id), [{ ...live, messages: [] }])

    applyServerEvent(qc, { type: 'session', projectId: P, session: live })
    expect(qc.getQueryData<DraftWithSession>(queryKeys.draft(P, draft.id))?.liveSession).toEqual(live)

    applyServerEvent(qc, { type: 'session', projectId: P, session: { ...live, status: 'finished' } })
    expect(qc.getQueryData<DraftWithSession>(queryKeys.draft(P, draft.id))?.liveSession).toBeNull()
    expect(qc.getQueryData<Transcript[]>(queryKeys.transcripts(P, draft.id))?.[0].status).toBe('finished')
    expect(invalidated(qc, queryKeys.transcripts(P, draft.id))).toBe(true)
  })

  it('leaves an unknown session and uncached data alone', () => {
    const qc = seeded()
    const other = liveSession(draft, { id: 'other' })
    qc.setQueryData<DraftWithSession>(queryKeys.draft(P, draft.id), { draft, liveSession: liveSession(draft) })
    qc.setQueryData<Transcript[]>(queryKeys.transcripts(P, draft.id), [])
    applyServerEvent(qc, { type: 'session', projectId: P, session: { ...other, status: 'stopped' } })
    expect(qc.getQueryData<DraftWithSession>(queryKeys.draft(P, draft.id))?.liveSession?.id).toBe('sess-live')
    expect(qc.getQueryData(queryKeys.transcripts(P, draft.id))).toEqual([])
  })

  it('appends and replaces chat messages', () => {
    const qc = seeded()
    const t: Transcript = { ...liveSession(draft), messages: [msg('a')] }
    qc.setQueryData<Transcript[]>(queryKeys.transcripts(P, draft.id), [t])
    applyServerEvent(qc, { type: 'message', projectId: P, draftId: draft.id, sessionId: t.id, message: msg('b') })
    applyServerEvent(qc, { type: 'message', projectId: P, draftId: draft.id, sessionId: t.id, message: msg('a', 'edited') })
    expect(qc.getQueryData<Transcript[]>(queryKeys.transcripts(P, draft.id))?.[0].messages).toEqual([msg('a', 'edited'), msg('b')])

    // A message for a session not yet in the list: refetch the list rather than guess its place.
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    applyServerEvent(qc, { type: 'message', projectId: P, draftId: draft.id, sessionId: 'new', message: msg('c') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.transcripts(P, draft.id) })
  })

  it('follows a Template Session', () => {
    const qc = seeded()
    const session = { id: 'ts', kind: 'template' as const, status: 'waiting' as const, writeConfirmed: false, startedAt: '', request: { workItemType: 'PBI' as const, purpose: 'x', examples: '' } }
    qc.setQueryData<TemplateTranscript>(queryKeys.templateSession('ts'), { ...session, messages: [msg('a')] })

    applyServerEvent(qc, { type: 'templateSession', session })
    expect(qc.getQueryData(queryKeys.liveTemplateSession)).toEqual({ session })
    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'ts', message: msg('b') })
    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'ts', message: msg('a', 'edited') })
    applyServerEvent(qc, { type: 'templateSession', session: { ...session, status: 'finished', templateId: 't1' } })

    expect(qc.getQueryData(queryKeys.liveTemplateSession)).toEqual({ session: null })
    expect(qc.getQueryData<TemplateTranscript>(queryKeys.templateSession('ts'))).toMatchObject({ status: 'finished', templateId: 't1', messages: [msg('a', 'edited'), msg('b')] })
    applyServerEvent(qc, { type: 'templateMessage', sessionId: 'unknown', message: msg('x') })
    expect(qc.getQueryData(queryKeys.templateSession('unknown'))).toBeUndefined()
  })
})
