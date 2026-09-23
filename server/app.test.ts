import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Draft } from '#core/draft/draftTypes.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'
import { startBackend } from '../test/server/testBackend.ts'

let backend: Awaited<ReturnType<typeof startBackend>>
const call = (...args: Parameters<typeof backend.call>) => backend.call(...args)

beforeEach(async () => {
  backend = await startBackend()
})
afterEach(() => backend.close())

const newProject = async () => (await call('POST', '/api/projects', { name: 'Customer Portal' })).body as { id: string }

/** A Draft whose first session is running and waiting for the human. */
async function grillingDraft() {
  const project = await newProject()
  const created = await call('POST', `/api/projects/${project.id}/drafts`, { workItemType: 'PBI', templateId: defaultPbiTemplate.id, requirement: 'Managers archive devices.' })
  expect(created.status).toBe(200)
  const { draft, session } = created.body as { draft: Draft; session: SessionSummary }
  await waitForStatus(project.id, draft.id, 'waiting')
  return { projectId: project.id, draftId: draft.id, sessionId: session.id }
}

async function transcripts(projectId: string, draftId: string) {
  return (await call('GET', `/api/projects/${projectId}/drafts/${draftId}/sessions`)).body as Transcript[]
}

const waitForStatus = (projectId: string, draftId: string, status: string) =>
  vi.waitFor(async () => expect((await transcripts(projectId, draftId)).at(-1)?.status).toBe(status), { timeout: 8000, interval: 50 })

/** Grills a first session to v1 through the fake Claude and the real submit script. */
async function writtenDraft() {
  const d = await grillingDraft()
  expect((await call('POST', `/api/sessions/${d.sessionId}/write`)).status).toBe(200)
  await waitForStatus(d.projectId, d.draftId, 'finished')
  return d
}

describe('request guards', () => {
  it('refuses other origins, non-JSON bodies, bad JSON and unknown routes', async () => {
    expect((await call('GET', '/api/projects', undefined, { origin: 'https://evil.example' })).status).toBe(403)
    const plain = await fetch('http://127.0.0.1:5397/api/projects', { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } })
    expect(plain.status).toBe(415)
    const bad = await fetch('http://127.0.0.1:5397/api/projects', { method: 'POST', body: '{nope', headers: { 'content-type': 'application/json' } })
    expect(bad.status).toBe(400)
    expect(await call('GET', '/api/nothing')).toMatchObject({ status: 404, body: { error: 'No route GET /api/nothing' } })
  })
})

describe('settings', () => {
  it('defaults, cleans and validates settings', async () => {
    expect((await call('GET', '/api/settings')).body).toMatchObject({ model: '', theme: 'system' })
    expect((await call('PUT', '/api/settings', { author: '@dorijan', model: ' opus ', theme: 'dark' })).body).toEqual({ author: 'dorijan', model: 'opus', theme: 'dark' })
    expect((await call('PUT', '/api/settings', { author: 42 })).status).toBe(400)
  })
})

describe('projects and Glossary', () => {
  it('creates, lists, renames and finds Projects', async () => {
    const project = await newProject()
    expect(project.id).toMatch(/^customer-portal-/)
    expect((await call('GET', '/api/projects')).body).toEqual([expect.objectContaining({ id: project.id, drafts: 0 })])
    expect((await call('PATCH', `/api/projects/${project.id}`, { name: 'Portal' })).body).toMatchObject({ name: 'Portal' })
    expect((await call('POST', '/api/projects', { name: '  ' })).status).toBe(400)
    expect((await call('GET', '/api/projects/missing')).status).toBe(404)
    expect((await call('GET', '/api/projects/..%2Fetc')).status).toBe(404)
  })

  it('starts a new Project from a Glossary the human brings, titled with the Project name', async () => {
    const project = (await call('POST', '/api/projects', { name: 'Billing Platform', glossary: '# Old name\n\nInvoices.\n\n## Language\n\n**Invoice**:\nA request for payment.\n' })).body
    const { markdown } = (await call('GET', `/api/projects/${project.id}/glossary`)).body
    expect(markdown).toBe('# Billing Platform\n\nInvoices.\n\n## Language\n\n**Invoice**:\nA request for payment.\n')
    expect((await call('GET', `/api/projects/${(await newProject()).id}/glossary`)).body.markdown).toBe('')
    expect((await call('POST', '/api/projects', { name: 'X', glossary: 42 })).status).toBe(400)
  })

  it('saves the Glossary against the version it edited', async () => {
    const project = await newProject()
    const url = `/api/projects/${project.id}/glossary`
    const empty = (await call('GET', url)).body
    const saved = await call('PUT', url, { markdown: '# Glossary', baseVersion: empty.version })
    expect(saved.body.markdown).toBe('# Glossary')
    expect(backend.events).toContainEqual({ type: 'glossary', projectId: project.id })
    expect((await call('PUT', url, { markdown: 'stale', baseVersion: empty.version })).status).toBe(409)
  })
})

describe('Drafts and Grilling Sessions', () => {
  it('validates a new Draft', async () => {
    const project = await newProject()
    const url = `/api/projects/${project.id}/drafts`
    expect((await call('POST', url, { workItemType: 'Story', templateId: defaultPbiTemplate.id, requirement: 'x' })).status).toBe(400)
    expect((await call('POST', url, { workItemType: 'Epic', templateId: defaultPbiTemplate.id, requirement: 'x' })).status).toBe(400)
    expect((await call('POST', url, { workItemType: 'PBI', templateId: defaultPbiTemplate.id, requirement: ' ' })).status).toBe(400)
    expect((await call('POST', url, { workItemType: 'PBI', templateId: 'nope', requirement: 'x' })).status).toBe(404)
  })

  it('grills a first session into v1 through the submit script', async () => {
    const d = await grillingDraft()
    const [t] = await transcripts(d.projectId, d.draftId)
    expect(t.messages.map((m) => m.role)).toEqual(['system', 'tool', 'claude'])
    expect(t.messages[1]).toMatchObject({ role: 'tool', summary: 'Read CONTEXT.md', outcome: 'ok' })
    expect((await call('GET', `/api/projects/${d.projectId}/drafts/${d.draftId}`)).body.liveSession).toMatchObject({ id: d.sessionId, status: 'waiting' })
    expect((await call('POST', `/api/projects/${d.projectId}/drafts/${d.draftId}/sessions`, { kind: 'first' })).status).toBe(409)

    await call('POST', `/api/sessions/${d.sessionId}/messages`, { text: 'Managers only', kind: 'answer' })
    await waitForStatus(d.projectId, d.draftId, 'waiting')
    await call('POST', `/api/sessions/${d.sessionId}/write`)
    await waitForStatus(d.projectId, d.draftId, 'finished')

    const { draft, liveSession } = (await call('GET', `/api/projects/${d.projectId}/drafts/${d.draftId}`)).body
    expect(draft.version).toBe(1)
    expect(liveSession).toBeNull()
    const messages = (await transcripts(d.projectId, d.draftId))[0].messages
    expect(messages).toContainEqual(expect.objectContaining({ role: 'tool', summary: 'Submitted the Draft for validation', outcome: 'ok' }))
    expect(messages).toContainEqual(expect.objectContaining({ role: 'system', tone: 'success', text: expect.stringContaining('Draft v1 written') }))
    expect(backend.events).toContainEqual(expect.objectContaining({ type: 'draft', projectId: d.projectId }))
    expect((await call('GET', `/api/projects/${d.projectId}/drafts`)).body).toEqual([expect.objectContaining({ id: d.draftId, version: 1, pendingChanges: 0 })])
    expect((await call('GET', `/api/projects/${d.projectId}/drafts/${d.draftId}/render`)).body.title).toBe(draft.title)
  })

  it('refuses human input the session cannot take', async () => {
    const d = await grillingDraft()
    expect((await call('POST', `/api/sessions/${d.sessionId}/messages`, { text: '  ' })).status).toBe(409)
    expect((await call('POST', `/api/sessions/unknown/write`)).status).toBe(409)
    expect((await call('POST', `/api/internal/sessions/${d.sessionId}/submit`, {}, { 'x-pbi-session-token': 'wrong' })).body).toMatchObject({ ok: false, reasons: [{ code: 'unknown-session' }] })
    expect((await call('DELETE', `/api/projects/${d.projectId}/drafts/${d.draftId}`)).status).toBe(409)
  })

  it('stops a session without writing, and reports a crashed one', async () => {
    const d = await grillingDraft()
    await call('POST', `/api/sessions/${d.sessionId}/stop`)
    await waitForStatus(d.projectId, d.draftId, 'stopped')
    expect((await call('GET', `/api/projects/${d.projectId}/drafts/${d.draftId}`)).body.draft.version).toBe(0)

    const again = await call('POST', `/api/projects/${d.projectId}/drafts/${d.draftId}/sessions`, { kind: 'first', humanNote: 'CRASH please' })
    expect(again.status).toBe(200)
    await waitForStatus(d.projectId, d.draftId, 'failed')
    expect((await transcripts(d.projectId, d.draftId)).at(-1)?.error).toContain('fake claude crashed')
  })

  it('edits a written Draft, sets References and deletes it', async () => {
    const d = await writtenDraft()
    const base = `/api/projects/${d.projectId}/drafts/${d.draftId}`
    const edited = await call('POST', `${base}/ops`, { op: 'retitle', title: 'Archive a device' })
    expect(edited.body).toMatchObject({ title: 'Archive a device', titleHumanEdited: true })
    expect((await call('POST', `${base}/ops`, { op: 'nonsense' })).status).toBe(400)
    expect((await call('POST', `${base}/ops`, { op: 'discardSection', sectionId: 'nope' })).status).toBe(409)
    expect((await call('PATCH', `${base}/references`, { references: [d.draftId, 'missing'] })).body.references).toEqual([])
    expect((await call('DELETE', base)).body).toEqual({ ok: true })
    expect((await call('GET', base)).status).toBe(404)
  })

  it('turns a later session into a Proposal that is triaged into v2', async () => {
    const d = await writtenDraft()
    const base = `/api/projects/${d.projectId}/drafts/${d.draftId}`
    expect((await call('POST', `${base}/sessions`, { kind: 'bogus' })).status).toBe(400)
    expect((await call('POST', `${base}/sessions`, { kind: 'upgrade' })).status).toBe(409)
    expect((await call('POST', `${base}/sessions`, { kind: 'focused', focus: { sectionId: 'nope' } })).status).toBe(409)

    const session = (await call('POST', `${base}/sessions`, { kind: 'iteration', humanNote: 'BA wants bulk archive' })).body
    await waitForStatus(d.projectId, d.draftId, 'waiting')
    await call('POST', `/api/sessions/${session.id}/write`)
    await waitForStatus(d.projectId, d.draftId, 'finished')

    const withProposal = (await call('GET', base)).body.draft as Draft
    expect(withProposal.proposal?.changes).toHaveLength(1)
    expect((await call('POST', `${base}/sessions`, { kind: 'iteration' })).status).toBe(409)
    const accepted = (await call('POST', `${base}/proposal/accept-clean`)).body as Draft
    expect(accepted).toMatchObject({ version: 2, proposal: null })

    await call('POST', `${base}/proposal/decide`, { changeId: 'none', accept: true })
    expect((await call('GET', base)).body.draft.version).toBe(2)
  })
})

describe('Continuations', () => {
  const continueUrl = (d: { projectId: string; draftId: string }, sessionId: string) => `/api/projects/${d.projectId}/drafts/${d.draftId}/sessions/${sessionId}/continue`

  it('continues a stopped first session in the same Claude conversation, and still writes v1', async () => {
    const d = await grillingDraft()
    await call('POST', `/api/sessions/${d.sessionId}/stop`)
    await waitForStatus(d.projectId, d.draftId, 'stopped')
    const [stopped] = await transcripts(d.projectId, d.draftId)
    expect(stopped.claudeSessionId).toMatch(/^claude-/)

    const continued = await call('POST', continueUrl(d, d.sessionId), { humanNote: 'Where were we?' })
    expect(continued.body).toMatchObject({ kind: 'first', continues: d.sessionId, claudeSessionId: stopped.claudeSessionId })
    await waitForStatus(d.projectId, d.draftId, 'waiting')
    const t = (await transcripts(d.projectId, d.draftId)).at(-1)!
    expect(t.claudeSessionId).toBe(stopped.claudeSessionId)
    expect(t.messages).toContainEqual(expect.objectContaining({ role: 'human', text: 'Where were we?' }))
    expect(t.messages).toContainEqual(expect.objectContaining({ role: 'claude', segments: [{ type: 'text', text: 'Picking up where we left off.' }] }))

    await call('POST', `/api/sessions/${continued.body.id}/write`)
    await waitForStatus(d.projectId, d.draftId, 'finished')
    expect((await call('GET', `/api/projects/${d.projectId}/drafts/${d.draftId}`)).body.draft.version).toBe(1)
  })

  it('continues a finished first session as a New Iteration that can only propose', async () => {
    const d = await writtenDraft()
    const continued = (await call('POST', continueUrl(d, d.sessionId), { humanNote: 'BA wants bulk archive' })).body
    expect(continued).toMatchObject({ kind: 'iteration', continues: d.sessionId })
    await waitForStatus(d.projectId, d.draftId, 'waiting')
    expect((await call('POST', continueUrl(d, d.sessionId), {})).status).toBe(409)

    await call('POST', `/api/sessions/${continued.id}/write`)
    await waitForStatus(d.projectId, d.draftId, 'finished')
    const draft = (await call('GET', `/api/projects/${d.projectId}/drafts/${d.draftId}`)).body.draft as Draft
    expect(draft).toMatchObject({ version: 1, proposal: { changes: [expect.anything()] } })
    expect((await call('POST', continueUrl(d, continued.id), {})).status).toBe(409)
    expect((await call('POST', continueUrl(d, 'sess-missing'), {})).status).toBe(404)
  })
})

describe('Focused Sessions', () => {
  it('grills one Section with a Reference in view, and names it in the chat', async () => {
    const other = await writtenDraft()
    const project = other.projectId
    const created = (await call('POST', `/api/projects/${project}/drafts`, { workItemType: 'PBI', templateId: defaultPbiTemplate.id, requirement: 'Bulk', references: [other.draftId] })).body
    await waitForStatus(project, created.draft.id, 'waiting')
    await call('POST', `/api/sessions/${created.session.id}/write`)
    await waitForStatus(project, created.draft.id, 'finished')

    const draft = (await call('GET', `/api/projects/${project}/drafts/${created.draft.id}`)).body.draft as Draft
    const scope = draft.sections.find((s) => s.key === 'scope')!
    const session = (await call('POST', `/api/projects/${project}/drafts/${draft.id}/sessions`, { kind: 'focused', focus: { sectionId: scope.id, entryId: scope.entries[0].id } })).body
    expect(session.focus).toEqual({ sectionId: scope.id, entryId: scope.entries[0].id, heading: `Scope › ${scope.entries[0].title}` })
    await waitForStatus(project, draft.id, 'waiting')
    const intro = (await transcripts(project, draft.id)).at(-1)!.messages[0]
    expect(intro).toMatchObject({ role: 'system', text: expect.stringContaining('and 1 Reference') })
    await call('POST', `/api/sessions/${session.id}/stop`)
    await waitForStatus(project, draft.id, 'stopped')
  })
})

describe('Templates', () => {
  it('keeps Defaults read-only and versions the human’s own', async () => {
    const list = (await call('GET', '/api/templates')).body
    expect(list.map((t: { isDefault: boolean }) => t.isDefault)).toContain(true)
    expect((await call('PUT', `/api/templates/${defaultPbiTemplate.id}`, { template: defaultPbiTemplate })).status).toBe(409)
    expect((await call('DELETE', `/api/templates/${defaultPbiTemplate.id}`)).status).toBe(409)

    const mine = (await call('POST', '/api/templates', { template: { ...defaultPbiTemplate, name: 'Team PBI' } })).body
    expect(mine).toMatchObject({ name: 'Team PBI', version: 1, isDefault: false })
    expect((await call('PUT', `/api/templates/${mine.id}`, { template: { ...mine, name: 'Team PBI v2' } })).body).toMatchObject({ version: 2 })
    expect((await call('POST', '/api/templates', { template: { ...defaultPbiTemplate, sections: [] } })).status).toBe(409)
    expect(backend.events).toContainEqual({ type: 'templates' })

    const bundle = (await call('POST', '/api/templates/export', { ids: [mine.id] })).body
    expect((await call('DELETE', `/api/templates/${mine.id}`)).body).toEqual({ ok: true })
    const preview = (await call('POST', '/api/templates/import/preview', { bundle })).body
    expect(preview).toMatchObject({ ok: true, items: [{ status: 'new', selected: true }] })
    expect((await call('POST', '/api/templates/import', { bundle, selected: [0] })).body).toHaveLength(1)
    expect((await call('POST', '/api/templates/import', { bundle: {}, selected: [] })).status).toBe(409)
  })

  it('grills a new Template in a Template Session', async () => {
    expect((await call('POST', '/api/template-sessions', { workItemType: 'Story', purpose: 'x' })).status).toBe(400)
    expect((await call('POST', '/api/template-sessions', { workItemType: 'PBI', purpose: ' ' })).status).toBe(409)
    const session = (await call('POST', '/api/template-sessions', { workItemType: 'PBI', purpose: 'Spikes', baseTemplateId: defaultPbiTemplate.id })).body
    expect(session.request).toMatchObject({ baseTemplateName: defaultPbiTemplate.name })
    expect((await call('GET', '/api/template-sessions/live')).body.session).toMatchObject({ id: session.id })
    expect((await call('POST', '/api/template-sessions', { workItemType: 'PBI', purpose: 'Again' })).status).toBe(409)

    const url = `/api/template-sessions/${session.id}`
    await vi.waitFor(async () => expect((await call('GET', url)).body.status).toBe('waiting'), { timeout: 8000, interval: 50 })
    await call('POST', `/api/sessions/${session.id}/write`)
    await vi.waitFor(async () => expect((await call('GET', url)).body.status).toBe('finished'), { timeout: 8000, interval: 50 })

    const done = (await call('GET', url)).body
    expect(done.templateId).toBeTruthy()
    expect((await call('GET', `/api/templates/${done.templateId}`)).body).toMatchObject({ name: 'Spike PBI', origin: { sessionId: session.id } })
    expect((await call('GET', '/api/template-sessions/live')).body.session).toBeNull()
  })
})

describe('restart', () => {
  it('marks sessions that were running as interrupted', async () => {
    const d = await grillingDraft()
    backend.supervisor.stopAll()
    await waitForStatus(d.projectId, d.draftId, 'stopped')
    const t = (await transcripts(d.projectId, d.draftId))[0]
    // Simulate a crash: the Transcript on disk still says it is running.
    const { saveTranscript } = await import('./storage/transcripts.ts')
    await saveTranscript({ ...t, status: 'thinking' })
    await backend.supervisor.markInterrupted()
    expect((await transcripts(d.projectId, d.draftId))[0]).toMatchObject({ status: 'interrupted' })
  })
})
