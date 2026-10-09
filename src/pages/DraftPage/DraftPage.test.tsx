// Tests for DraftPage: the full-screen chat before v1, and editing, triaging and session control from v1 on.
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { openProposal } from '#core/proposal/classify.ts'
import type { ChatMessage, Transcript } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import DraftPage from '@/pages/DraftPage/DraftPage'
import { draftBackend, liveSession } from '@test/mocks/draftBackend'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

const renderPage = (draft: Draft) =>
  render(<DraftPage />, { route: `/p/${draft.projectId}/d/${draft.id}`, path: '/p/:projectId/d/:draftId' })

const transcript = (draft: Draft, messages: ChatMessage[], patch: Partial<Transcript> = {}): Transcript => ({
  ...liveSession(draft, { kind: 'first', status: 'finished' }),
  messages,
  ...patch,
})

const at = '2026-09-22T10:00:00Z'
const grillingMessages: ChatMessage[] = [
  { id: 'm1', at, role: 'human', text: 'Managers need to archive devices.', kind: 'message' },
  { id: 'm2', at, role: 'tool', tool: 'Read', summary: 'Read the Glossary' },
  { id: 'm3', at, role: 'tool', tool: 'Grep', summary: 'Searched for archive' },
  { id: 'm4', at, role: 'tool', tool: 'WebFetch', summary: 'Fetched the wiki' },
  { id: 'm5', at, role: 'tool', tool: 'Bash', summary: 'Submitted a draft', outcome: 'error' },
  { id: 'm6', at, role: 'tool', tool: 'Write', summary: 'Wrote a file', outcome: 'denied' },
  { id: 'm7', at, role: 'tool', tool: 'Edit', summary: 'Edited a file' },
  { id: 'm8', at, role: 'system', text: 'Session started', tone: 'info' },
  {
    id: 'm9',
    at,
    role: 'claude',
    segments: [
      { type: 'text', text: 'Let us pin down **telemetry**.' },
      { type: 'question', question: 'Keep telemetry?', recommended: 'Yes, alerts muted', options: ['No'] },
    ],
  },
]

/** v1 with AC02 hand-edited, then a Proposal: a Clean add and a Conflict on AC02. */
function withProposal() {
  let draft = v1Draft()
  const ac = sectionByKey(draft, 'acceptanceCriteria')
  draft = applyHumanOp(draft, {
    op: 'editEntry',
    sectionId: ac.id,
    entryId: ac.entries[1].id,
    body: 'Given my wording\nThen mine',
  })
  const deps = sectionByKey(draft, 'dependencies')
  return openProposal(
    draft,
    [
      { kind: 'addEntry', sectionId: deps.id, title: 'Backend API must provide', body: 'POST /devices/archive (bulk)' },
      {
        kind: 'replaceEntry',
        sectionId: ac.id,
        entryId: ac.entries[1].id,
        body: 'Given Claude’s wording\nThen Claude’s',
      },
    ],
    { sessionId: 'sess-1', kind: 'focused', now: meta.date },
  )
}

describe('DraftPage before v1', () => {
  const draft = newDraft({
    projectId: 'customer-portal',
    workItemType: 'PBI',
    template: defaultPbiTemplate,
    requirement: 'Managers need to archive devices.',
    now: meta.date,
  })

  it('is a full-screen grilling chat where questions are answered', async () => {
    const live = liveSession(draft, { id: 'sess-1', kind: 'first' })
    const api = draftBackend(draft, {
      liveSession: live,
      transcripts: [transcript(draft, grillingMessages, { id: 'sess-1', status: 'waiting' })],
    })
    const { user } = renderPage(draft)

    expect(await screen.findByText('Keep telemetry?')).toBeInTheDocument()
    expect(screen.getByText('(blocked by the session allowlist)')).toBeInTheDocument()
    expect(screen.getByText('(refused)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Recommended/ }))

    await vi.waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'POST',
        path: '/api/sessions/sess-1/messages',
        body: { text: 'Yes, alerts muted', kind: 'answer' },
      }),
    )
  })

  it('opens the Glossary beside the chat', async () => {
    draftBackend(draft, { transcripts: [transcript(draft, grillingMessages)] })
    const { user } = renderPage(draft)
    await user.click(await screen.findByRole('button', { name: /Glossary/ }))
    expect(screen.getByRole('heading', { name: 'Customer Portal Glossary' })).toBeInTheDocument()
  })

  it('starts a new first session by typing when none is running', async () => {
    const api = draftBackend(draft, { transcripts: [transcript(draft, grillingMessages)] })
    const { user } = renderPage(draft)
    await user.type(await screen.findByRole('textbox', { name: 'Message Claude' }), 'Also bulk archive{Enter}')
    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({
          path: endpoints.draftSessions(draft.projectId, draft.id),
          body: { kind: 'first', humanNote: 'Also bulk archive' },
        }),
      ),
    )
  })

  it('deletes the Draft and returns to the Project', async () => {
    const api = draftBackend(draft, { transcripts: [transcript(draft, grillingMessages)] })
    const { user } = renderPage(draft)
    await user.click(await screen.findByRole('button', { name: 'Delete Draft' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Draft' }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
    expect(api.requests.map((request) => request.method)).toContain('DELETE')
  })
})

describe('DraftPage from v1', () => {
  it('edits a prose Section in place', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft)
    const { user } = renderPage(draft)

    const story = await screen.findByRole('region', { name: 'User Story' })
    await user.click(within(story).getByRole('button', { name: /As a Manager/ }))
    const box = within(story).getByRole('textbox', { name: 'Text' })
    await user.clear(box)
    await user.type(box, 'As a Manager, I archive devices.')
    await user.click(within(story).getByRole('button', { name: 'Save' }))

    await vi.waitFor(() =>
      expect(api.requests.at(-1)?.body).toMatchObject({ op: 'editSection', body: 'As a Manager, I archive devices.' }),
    )
    expect(await within(story).findByText('As a Manager, I archive devices.')).toBeInTheDocument()
  })

  it('discards and restores an Entry, and adds one', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft)
    const { user } = renderPage(draft)

    const scope = await screen.findByRole('region', { name: 'Scope' })
    await user.click(within(scope).getAllByRole('button', { name: /Discard/ })[1]) // [0] is the Section's own
    await user.click(await within(scope).findByRole('button', { name: /Restore/ }))
    await vi.waitFor(() =>
      expect(api.requests.map((request) => (request.body as { op: string }).op)).toEqual([
        'discardEntry',
        'restoreEntry',
      ]),
    )

    await user.click(within(scope).getByRole('button', { name: /Add Entry/ }))
    await user.type(within(scope).getByRole('textbox', { name: 'Entry title' }), 'Later')
    await user.type(within(scope).getByRole('textbox', { name: 'Entry text' }), 'Bulk archive')
    await user.click(within(scope).getByRole('button', { name: 'Add' }))
    expect(await within(scope).findByText('Later')).toBeInTheDocument()
  })

  it('discards a whole Section, except a locked one', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft)
    const { user } = renderPage(draft)

    const design = await screen.findByRole('region', { name: 'Design' })
    await user.click(within(design).getByRole('button', { name: /Discard/ }))
    await vi.waitFor(() => expect(api.requests.at(-1)?.body).toMatchObject({ op: 'discardSection' }))
    expect(await screen.findByText('Discarded', { selector: 'span' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'User Story' })).queryByRole('button', { name: /Discard/ }),
    ).not.toBeInTheDocument()
  })

  it('renames the Draft', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft)
    const { user } = renderPage(draft)
    await user.click(await screen.findByRole('button', { name: draft.title }))
    const box = screen.getByRole('textbox', { name: 'Text' })
    await user.clear(box)
    await user.type(box, 'Archive a device')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(api.requests.at(-1)?.body).toEqual({ op: 'retitle', title: 'Archive a device' }))
  })

  it('triages a Proposal: all Clean at once, a Conflict by hand', async () => {
    const draft = withProposal()
    const api = draftBackend(draft)
    const { user } = renderPage(draft)

    expect(await screen.findByText('1 Clean')).toBeInTheDocument()
    expect(screen.getByText('1 Conflict')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept all clean (1)' }))
    expect(await screen.findByText('1 decided', { exact: false })).toBeInTheDocument()

    const conflict = screen.getByRole('group', { name: /^Conflict/ })
    expect(within(conflict).getByText('Yours')).toBeInTheDocument()
    await user.click(within(conflict).getByRole('button', { name: 'Keep mine' }))
    await vi.waitFor(() => expect(api.requests.at(-1)?.body).toMatchObject({ accept: false }))
    await vi.waitFor(() => expect(screen.queryByText(/Clean,/)).not.toBeInTheDocument())
  })

  it('shows title and new-Section changes where they land', async () => {
    let draft = applyHumanOp(v1Draft(), { op: 'retitle', title: 'Archive a device' })
    draft = { ...draft, sections: draft.sections.filter((section) => section.key !== 'design') }
    draft = openProposal(
      draft,
      [
        { kind: 'retitle', title: 'Archive devices' },
        { kind: 'addSection', sectionKey: 'design', body: 'Figma: archive dialog' },
      ],
      { sessionId: 'sess-1', kind: 'upgrade', now: meta.date },
    )
    const api = draftBackend(draft)
    const { user } = renderPage(draft)

    const retitle = await screen.findByRole('group', { name: /^Conflict/ })
    expect(within(retitle).getByText('You retitled this Draft')).toBeInTheDocument()
    const added = screen.getByRole('group', { name: /^Clean Change/ })
    expect(within(added).getByText('Figma: archive dialog')).toBeInTheDocument()
    await user.click(within(added).getByRole('button', { name: 'Reject' }))
    await vi.waitFor(() => expect(api.requests.at(-1)?.body).toMatchObject({ accept: false }))
    await user.click(within(retitle).getByRole('button', { name: 'Take Claude’s' }))
    expect(await screen.findByRole('heading', { name: 'Archive devices' })).toBeInTheDocument()
  })

  it('starts a Focused Session from "Grill this" with a note', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft)
    const { user } = renderPage(draft)

    const design = await screen.findByRole('region', { name: 'Design' })
    await user.click(within(design).getByRole('button', { name: /Grill this/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Grill “Design”')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Note for Claude' }), 'Figma is ready')
    await user.click(within(dialog).getByRole('button', { name: 'Start grilling' }))

    const design2 = sectionByKey(draft, 'design')
    await vi.waitFor(() =>
      expect(api.requests.at(-1)?.body).toEqual({
        kind: 'focused',
        focus: { sectionId: design2.id },
        humanNote: 'Figma is ready',
      }),
    )
  })

  it('offers an upgrade when the Template has a newer version', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft, { templates: [{ ...draft.template, version: draft.template.version + 1 }] })
    const { user } = renderPage(draft)

    await user.click(await screen.findByRole('button', { name: 'Upgrade this Draft' }))
    expect(within(screen.getByRole('dialog')).getByText('Upgrade to the latest Template')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    await vi.waitFor(() => expect(api.requests.at(-1)?.body).toEqual({ kind: 'upgrade', humanNote: '' }))
  })

  it('sets References to other written Drafts', async () => {
    const draft = v1Draft()
    const other = {
      id: 'other',
      projectId: draft.projectId,
      title: 'Billing export',
      requirement: '',
      workItemType: 'Feature' as const,
      version: 2,
      templateName: '',
      pendingChanges: 0,
      updatedAt: '',
    }
    const api = draftBackend(draft, { otherDrafts: [other] })
    const { user } = renderPage(draft)

    await user.click(await screen.findByRole('button', { name: /References/ }))
    await user.click(await screen.findByRole('checkbox', { name: /Billing export/ }))
    await vi.waitFor(() => expect(api.requests.at(-1)?.body).toEqual({ references: ['other'] }))
    expect(await screen.findByRole('button', { name: 'References (1)' })).toBeInTheDocument()
  })

  it('renders the fields for Azure DevOps and copies one', async () => {
    const draft = v1Draft()
    draftBackend(draft)
    const { user } = renderPage(draft)

    await user.click(await screen.findByRole('button', { name: /Copy for Azure DevOps/ }))
    const copyTitle = await screen.findByRole('button', { name: 'Copy Title' })
    expect(screen.getByRole('button', { name: 'Copy Description' })).toBeInTheDocument()
    await user.click(copyTitle)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(draft.title)
  })

  it('continues an ended session by typing, or goes back to a new one', async () => {
    const draft = v1Draft()
    const old = transcript(draft, grillingMessages, { id: 'sess-old' })
    const ended = transcript(draft, grillingMessages, {
      id: 'sess-1',
      kind: 'iteration',
      claudeSessionId: 'claude-1',
      startedAt: '2026-09-22T11:00:00Z',
    })
    const api = draftBackend(draft, { transcripts: [old, ended] })
    const { user } = renderPage(draft)

    await user.click(await screen.findByRole('button', { name: 'Continue New Iteration' }))
    expect(screen.queryByRole('button', { name: 'Continue First session' })).not.toBeInTheDocument()
    const box = screen.getByRole('textbox', { name: 'Message Claude' })
    expect(box).toHaveFocus()
    expect(screen.getByText(/Continuing New Iteration/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start a new session instead' }))
    expect(screen.queryByText(/Continuing New Iteration/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue New Iteration' }))
    await user.type(box, 'Bulk archive is back{Enter}')
    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({
          path: endpoints.continueSession(draft.projectId, draft.id, 'sess-1'),
          body: { humanNote: 'Bulk archive is back' },
        }),
      ),
    )
  })

  it('offers to continue the latest session right in the message box', async () => {
    const draft = v1Draft()
    const api = draftBackend(draft, {
      transcripts: [transcript(draft, grillingMessages, { id: 'sess-1', claudeSessionId: 'claude-1' })],
    })
    const { user } = renderPage(draft)

    await user.click(await screen.findByRole('button', { name: 'Continue this session instead' }))
    expect(screen.getByText(/Continuing First session/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue this session instead' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Message Claude' }), 'One more AC{Enter}')
    await vi.waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({ path: endpoints.continueSession(draft.projectId, draft.id, 'sess-1') }),
      ),
    )
  })

  it('cannot continue while a Proposal waits for triage', async () => {
    const draft = withProposal()
    draftBackend(draft, { transcripts: [transcript(draft, grillingMessages, { claudeSessionId: 'claude-1' })] })
    renderPage(draft)
    expect(await screen.findByPlaceholderText(/Triage the Proposal/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Continue/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue this session instead' })).not.toBeInTheDocument()
  })

  it('drives a running session from the composer', async () => {
    const draft = v1Draft()
    const live = liveSession(draft)
    const ready: ChatMessage = {
      id: 'r1',
      at,
      role: 'claude',
      segments: [{ type: 'ready', summary: 'Two ACs change.' }],
    }
    const older = transcript(draft, grillingMessages, { id: 'sess-old' })
    const api = draftBackend(draft, {
      liveSession: live,
      transcripts: [older, transcript(draft, [ready], { id: live.id, kind: 'iteration', status: 'waiting' })],
    })
    const { user } = renderPage(draft)

    expect(await screen.findByText('Ready to write the Proposal')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I want to add something' }))
    expect(screen.getByRole('textbox', { name: 'Message Claude' })).toHaveFocus()
    await user.type(screen.getByRole('textbox', { name: 'Message Claude' }), 'One more AC{Enter}')
    await user.click(screen.getByRole('button', { name: 'Write the Proposal' }))
    await user.click(screen.getByRole('button', { name: /Stop/ }))

    await vi.waitFor(() =>
      expect(api.requests.map((request) => request.path)).toEqual([
        '/api/sessions/sess-live/messages',
        '/api/sessions/sess-live/write',
        '/api/sessions/sess-live/stop',
      ]),
    )

    await user.click(screen.getByRole('button', { name: /First session/ }))
    expect(await screen.findByText('Keep telemetry?')).toBeInTheDocument()
  })

  it('switches between Sessions and Glossary, and Draft and Chat on small screens', async () => {
    const draft = v1Draft()
    draftBackend(draft, { liveSession: liveSession(draft) })
    const { user } = renderPage(draft)

    await user.click(await screen.findByRole('tab', { name: 'Glossary' }))
    expect(await screen.findByText(/No terms yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    await user.click(screen.getByRole('tab', { name: 'Chat (running)' }))
    expect(screen.getByRole('tab', { name: 'Chat (running)' })).toHaveAttribute('aria-selected', 'true')
  })

  it('widens the side panel beside the Draft, on either tab, and narrows it back', async () => {
    const draft = v1Draft()
    draftBackend(draft)
    const { user } = renderPage(draft)
    const columns = async () => (await screen.findByRole('complementary')).parentElement

    const widen = await screen.findByRole('button', { name: 'Widen panel' })
    expect(widen).toHaveAttribute('aria-pressed', 'false')
    expect(await columns()).toHaveClass('lg:grid-cols-[minmax(360px,440px)_1fr]')
    await user.click(widen)

    expect(screen.getByRole('button', { name: 'Narrow panel' })).toHaveAttribute('aria-pressed', 'true')
    expect(await columns()).toHaveClass('lg:grid-cols-[minmax(360px,3fr)_2fr]')

    await user.click(screen.getByRole('tab', { name: 'Glossary' }))
    expect(await columns()).toHaveClass('lg:grid-cols-[minmax(360px,3fr)_2fr]')

    await user.click(screen.getByRole('button', { name: 'Narrow panel' }))
    expect(screen.getByRole('button', { name: 'Widen panel' })).toHaveAttribute('aria-pressed', 'false')
    expect(await columns()).toHaveClass('lg:grid-cols-[minmax(360px,440px)_1fr]')
  })

  it('shows why the Draft cannot load', async () => {
    const draft = v1Draft()
    draftBackend(draft)
    server.use(
      http.get(`*${endpoints.draft(draft.projectId, draft.id)}`, () =>
        HttpResponse.json({ error: 'No such Draft' }, { status: 404 }),
      ),
    )
    renderPage(draft)
    expect(await screen.findByText('No such Draft')).toBeInTheDocument()
  })
})
