// Helpers for the Prototype server tests: a Draft at v1 made by a real (fake-Claude) Grilling Session, markers the
// fake Claude reacts to, and the Prototype routes with the waiting they need.
import { expect, vi } from 'vitest'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { PrototypeRow } from '#core/prototype/prototypeRecords.ts'
import type { PrototypeSessionSummary, SessionSummary } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import type { TestBackend } from './testBackend.ts'

const WAIT = { timeout: 8000, interval: 50 }

export interface Grilled {
  projectId: string
  draftId: string
  sessionId: string
}

export const draftUrl = ({ projectId, draftId }: Grilled) => `/api/projects/${projectId}/drafts/${draftId}`
export const rowsUrl = (grilled: Grilled) => `${draftUrl(grilled)}/prototypes`
export const startUrl = (grilled: Grilled) => `${draftUrl(grilled)}/prototype-sessions`
export const stopUrl = (grilled: Grilled, sessionId: string) =>
  `/api/projects/${grilled.projectId}/prototype-sessions/${sessionId}/stop`

export function prototypeKit(backend: TestBackend) {
  const call = (...args: Parameters<TestBackend['call']>) => backend.call(...args)

  const waitForGrilling = (grilled: Grilled, status: string, sessionId = grilled.sessionId) =>
    vi.waitFor(async () => {
      const all = (await call('GET', `${draftUrl(grilled)}/sessions`)).body as SessionSummary[]
      expect(all.find((session) => session.id === sessionId)?.status).toBe(status)
    }, WAIT)

  /** A Draft whose first Grilling Session is running and waiting (so still at v0), with `images` on the requirement. */
  async function grillingDraft(images: unknown[] = [], inProjectId?: string): Promise<Grilled> {
    const project = inProjectId
      ? { id: inProjectId }
      : ((await call('POST', '/api/projects', { name: 'Customer Portal' })).body as { id: string })
    const created = await call('POST', `/api/projects/${project.id}/drafts`, {
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: 'Managers archive devices.',
      images,
    })
    const { draft, session } = created.body as { draft: Draft; session: SessionSummary }
    const grilled = { projectId: project.id, draftId: draft.id, sessionId: session.id }
    await waitForGrilling(grilled, 'waiting')
    return grilled
  }

  /** A Draft at v1: its first Grilling Session ran and was told to write. */
  async function draftAtV1(images: unknown[] = [], inProjectId?: string): Promise<Grilled> {
    const grilled = await grillingDraft(images, inProjectId)
    await call('POST', `/api/sessions/${grilled.sessionId}/write`)
    await waitForGrilling(grilled, 'finished')
    return grilled
  }

  const getDraft = async (grilled: Grilled) => (await call('GET', draftUrl(grilled))).body.draft as Draft

  /** Puts a marker the fake Claude reacts to into the Draft's text. */
  async function steer(grilled: Grilled, marker: string) {
    const section = (await getDraft(grilled)).sections.find((candidate) => candidate.shape === 'prose')!
    const body = `${section.body} ${marker}`
    const edited = await call('POST', `${draftUrl(grilled)}/ops`, { op: 'editSection', sectionId: section.id, body })
    expect(edited.status).toBe(200)
  }

  const startPrototype = (grilled: Grilled, body: unknown = {}) => call('POST', startUrl(grilled), body)
  const rowsOf = async (grilled: Grilled) => (await call('GET', rowsUrl(grilled))).body as PrototypeRow[]
  const kindsOf = async (grilled: Grilled) => (await rowsOf(grilled)).map((row) => row.kind)

  const waitForRows = (grilled: Grilled, kinds: string[]) =>
    vi.waitFor(async () => expect(await kindsOf(grilled)).toEqual(kinds), WAIT)

  /** Starts a session and waits until the newest row is of `kind`; returns the summary it started with. */
  async function runPrototype(grilled: Grilled, kind: string, body: unknown = {}) {
    const started = await startPrototype(grilled, body)
    expect(started.status).toBe(200)
    await vi.waitFor(async () => expect((await kindsOf(grilled))[0]).toBe(kind), WAIT)
    return started.body as PrototypeSessionSummary
  }

  /** The newest row, which must be a finished Prototype. */
  async function newestPrototype(grilled: Grilled) {
    const [row] = await rowsOf(grilled)
    if (row.kind !== 'finished') throw new Error(`expected a finished row, got ${row.kind}`)
    return row.prototype
  }

  return {
    call,
    waitForGrilling,
    grillingDraft,
    draftAtV1,
    getDraft,
    steer,
    startPrototype,
    rowsOf,
    kindsOf,
    waitForRows,
    runPrototype,
    newestPrototype,
  }
}
