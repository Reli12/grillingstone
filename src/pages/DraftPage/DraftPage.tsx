// Layout D (prototype verdict): until v1 exists the session is a full-screen chat; from v1 on the chat
// sits left and the live Draft right. "Grill this" starts a Focused Session; Proposals render inline. An ended
// session can be continued from the chat (ADR-0014).
import { useMemo, useRef, useState } from 'react'
import { BookOpenText, ClipboardCopy, Link2, Sparkles, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { LIVE_STATUSES, type Transcript } from '#core/session/sessionTypes.ts'
import {
  useAcceptAllClean,
  useContinueSession,
  useDecide,
  useDeleteDraft,
  useDraft,
  useDraftOp,
  useSay,
  useStartSession,
  useStopSession,
  useTranscripts,
  useWriteNow,
} from '@/api/hooks/drafts/draftHooks'
import { useProject } from '@/api/hooks/projects/projectHooks'
import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ChatThread } from '@/components/features/chat/chatThread/chatThread'
import { Composer } from '@/components/features/chat/composer/composer'
import { NewSessionComposer } from '@/components/features/chat/newSessionComposer/newSessionComposer'
import { CopyForAdo } from '@/components/features/draft/copyForAdo/copyForAdo'
import { DeleteDraftDialog } from '@/components/features/draft/dialogs/deleteDraftDialog/deleteDraftDialog'
import { ReferencesDialog } from '@/components/features/draft/dialogs/referencesDialog/referencesDialog'
import { StartSessionDialog, type StartIntent } from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import { DraftSheet } from '@/components/features/draft/draftSheet/draftSheet'
import { ProposalBar } from '@/components/features/draft/proposalBar/proposalBar'
import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
import { DraftEditorContext, type DraftEditorValue } from '@/context/DraftEditor/DraftEditor'
import { SESSION_TITLES } from '@/constants/SessionConstants'
import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

export default function DraftPage() {
  const { projectId = '', draftId = '' } = useParams()
  const navigate = useNavigate()
  const composer = useRef<HTMLTextAreaElement>(null)

  const [intent, setIntent] = useState<StartIntent | null>(null)
  const [side, setSide] = useState<'chat' | 'glossary'>('chat')
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [refsOpen, setRefsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'chat' | 'draft'>('draft')
  /** The ended session the next message continues, instead of starting a new one. */
  const [continueFrom, setContinueFrom] = useState<Transcript | null>(null)

  const { data, error } = useDraft(projectId, draftId)
  const { data: transcripts } = useTranscripts(projectId, draftId)
  const { data: project } = useProject(projectId)
  const { data: templates } = useTemplates()
  const op = useDraftOp(projectId, draftId)
  const decide = useDecide(projectId, draftId)
  const acceptClean = useAcceptAllClean(projectId, draftId)
  const start = useStartSession(projectId, draftId)
  const continueSession = useContinueSession(projectId, draftId)
  const say = useSay()
  const writeNow = useWriteNow()
  const stop = useStopSession()
  const remove = useDeleteDraft(projectId)

  const draft = data?.draft
  const live = data?.liveSession ?? undefined
  const busy = op.isPending || decide.isPending || acceptClean.isPending

  const editor = useMemo<DraftEditorValue | null>(
    () =>
      draft
        ? {
            draft,
            pending: draft.proposal?.changes.filter((c) => c.status === 'pending') ?? [],
            sessionRunning: !!live,
            busy,
            apply: (o) => op.mutate(o),
            decide: (changeId, accept) => decide.mutate({ changeId, accept }),
            grill: (t) => setIntent({ kind: 'focused', ...t }),
          }
        : null,
    [draft, live, busy, op, decide],
  )

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!draft || !transcripts || !editor) return <PageLoading />

  const latestTemplate = templates?.find((t) => t.id === draft.template.id)
  const canUpgrade = draft.version > 0 && latestTemplate && latestTemplate.version > draft.template.version && !draft.proposal && !live

  const handlers = {
    onAnswer: (sessionId: string, text: string) => say.mutate({ sessionId, text, kind: 'answer' }),
    onWrite: (sessionId: string) => writeNow.mutate(sessionId),
    onAddSomething: () => composer.current?.focus(),
  }
  const startSession = (note: string) => {
    if (!intent) return
    start.mutate(
      {
        kind: intent.kind,
        ...(intent.kind === 'focused' ? { focus: { sectionId: intent.sectionId, entryId: intent.entryId } } : {}),
        humanNote: note,
      },
      {
        onSuccess: () => {
          setIntent(null)
          setSide('chat')
          setMobileView('chat')
        },
      },
    )
  }

  // With no session running, typing starts a new one: a fresh first session before v1, otherwise a New
  // Iteration. Or it continues the ended session the human picked. Both begin from the current Draft.
  const showChat = () => {
    setSide('chat')
    setMobileView('chat')
  }
  const startByTyping = (text: string) =>
    continueFrom
      ? continueSession.mutate(
          { sessionId: continueFrom.id, humanNote: text },
          {
            onSuccess: () => {
              setContinueFrom(null)
              showChat()
            },
          },
        )
      : start.mutate({ kind: draft.version === 0 ? 'first' : 'iteration', humanNote: text }, { onSuccess: showChat })
  const blockedReason = draft.proposal ? 'Triage the Proposal in the Draft first — Claude can have only one open at a time.' : undefined
  const canContinue = (t: { status: Transcript['status']; claudeSessionId?: string }) => !live && !blockedReason && !!t.claudeSessionId && !LIVE_STATUSES.includes(t.status)
  const latest = transcripts.at(-1)

  const chat = (
    <>
      <ChatThread
        transcripts={transcripts}
        liveSessionId={live?.id}
        canContinue={canContinue}
        onContinue={(id) => setContinueFrom(transcripts.find((t) => t.id === id) ?? null)}
        {...handlers}
      />
      {live ? (
        <Composer
          ref={composer}
          session={live}
          sending={say.isPending}
          onSend={(text) => say.mutate({ sessionId: live.id, text, kind: 'message' })}
          onWriteNow={() => writeNow.mutate(live.id)}
          onStop={() => stop.mutate(live.id)}
        />
      ) : (
        <NewSessionComposer
          starting={start.isPending || continueSession.isPending}
          onStart={startByTyping}
          blockedReason={blockedReason}
          onContinueLatest={latest && canContinue(latest) ? () => setContinueFrom(latest) : undefined}
          continuing={continueFrom ? { label: `${SESSION_TITLES[continueFrom.kind]}${continueFrom.focus ? ` on ${continueFrom.focus.heading}` : ''}`, onCancel: () => setContinueFrom(null) } : undefined}
          placeholder={
            continueFrom
              ? 'Tell Claude why you are back…'
              : draft.version === 0
                ? 'Tell Claude more to start grilling again…'
                : 'Message Claude to start a new session on the whole Draft…'
          }
          hint={
            continueFrom
              ? 'Claude remembers that conversation and gets the current Draft'
              : draft.version === 0
                ? 'Starts a new first session from your requirement'
                : 'Or press “Grill this” on a Section to focus on one part'
          }
        />
      )}
    </>
  )

  const dialogs = (
    <>
      <StartSessionDialog key={intent ? JSON.stringify(intent) : 'none'} intent={intent} onClose={() => setIntent(null)} onStart={startSession} pending={start.isPending} />
      <CopyForAdo projectId={projectId} draftId={draftId} open={copyOpen} onClose={() => setCopyOpen(false)} />
      <ReferencesDialog open={refsOpen} onClose={() => setRefsOpen(false)} draft={draft} />
      <DeleteDraftDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDelete={() => remove.mutate(draftId, { onSuccess: () => navigate(routesPaths.project(projectId)) })} />
    </>
  )

  // ── Before v1: full-screen grilling ──────────────────────────────────────
  if (draft.version === 0)
    return (
      <div className="flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start gap-4 border-b border-line bg-sheet/70 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink-faint">
                <Link to={routesPaths.project(projectId)} className="hover:text-ink">
                  {project?.name}
                </Link>
                , new {draft.workItemType} in the {draft.template.name}
              </p>
              <p className="mt-0.5 line-clamp-2 font-serif text-[17px] text-ink">{draft.requirement}</p>
            </div>
            <Button size="sm" variant={glossaryOpen ? 'ink' : 'outline'} onClick={() => setGlossaryOpen((v) => !v)} aria-pressed={glossaryOpen}>
              <BookOpenText size={14} /> Glossary
            </Button>
            {!live && (
              <Button size="sm" variant="quiet" onClick={() => setDeleteOpen(true)} aria-label="Delete Draft">
                <Trash2 size={14} />
              </Button>
            )}
          </header>
          {chat}
        </div>
        {glossaryOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-sheet p-4">
            <h2 className="mb-3 font-serif text-lg font-semibold">{project?.name} Glossary</h2>
            <GlossaryPanel projectId={projectId} compact />
          </aside>
        )}
        {dialogs}
      </div>
    )

  // ── From v1 on: chat left, live Draft right ──────────────────────────────
  return (
    <DraftEditorContext.Provider value={editor}>
      <div className="flex h-full flex-col lg:grid lg:grid-cols-[minmax(360px,440px)_1fr]">
        <div className="flex shrink-0 border-b border-line bg-sheet p-1 lg:hidden" role="tablist">
          {(['draft', 'chat'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)} className={cn('h-8 flex-1 rounded-md text-sm font-medium', mobileView === v ? 'bg-fog-deep text-ink' : 'text-ink-soft')}>
              {v === 'draft' ? 'Draft' : live ? 'Chat (running)' : 'Chat'}
            </button>
          ))}
        </div>

        <aside className={cn('min-h-0 flex-1 flex-col border-r border-line lg:flex', mobileView === 'chat' ? 'flex' : 'hidden')}>
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2" role="tablist">
            <button role="tab" aria-selected={side === 'chat'} onClick={() => setSide('chat')} className={cn('h-8 rounded-md px-3 text-sm', side === 'chat' ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:text-ink')}>
              Sessions
            </button>
            <button role="tab" aria-selected={side === 'glossary'} onClick={() => setSide('glossary')} className={cn('h-8 rounded-md px-3 text-sm', side === 'glossary' ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:text-ink')}>
              Glossary
            </button>
            {live && <span className="ml-auto flex items-center gap-1.5 pr-1 text-[13px] text-claude"><span className="size-2 animate-pulse rounded-full bg-claude" /> Session running</span>}
          </div>
          {side === 'chat' ? (
            chat
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <GlossaryPanel projectId={projectId} compact />
            </div>
          )}
        </aside>

        <div className={cn('min-h-0 flex-1 overflow-y-auto bg-sheet lg:block', mobileView === 'draft' ? 'block' : 'hidden')}>
          <div className="px-4 pb-16 sm:px-10">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <p className="text-[13px] text-ink-faint">
                <Link to={routesPaths.project(projectId)} className="hover:text-ink">
                  {project?.name}
                </Link>
                , {draft.workItemType} in the {draft.template.name} v{draft.template.version}, <span className="font-medium text-ink">Draft v{draft.version}</span>
              </p>
              <span className="ml-auto" />
              <Button size="sm" variant="quiet" onClick={() => setRefsOpen(true)}>
                <Link2 size={14} /> References{draft.references.length ? ` (${draft.references.length})` : ''}
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setDeleteOpen(true)} disabled={!!live} aria-label="Delete Draft">
                <Trash2 size={14} />
              </Button>
              <Button size="sm" variant="ink" onClick={() => setCopyOpen(true)}>
                <ClipboardCopy size={14} /> Copy for Azure DevOps
              </Button>
            </div>

            {canUpgrade && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-claude/30 bg-claude-wash px-4 py-2.5 text-sm">
                <Sparkles size={16} className="text-claude" />
                <span className="flex-1">
                  {latestTemplate.name} is now at v{latestTemplate.version}; this Draft uses v{draft.template.version}.
                </span>
                <Button size="sm" variant="claude" onClick={() => setIntent({ kind: 'upgrade' })}>
                  Upgrade this Draft
                </Button>
              </div>
            )}

            {draft.proposal && <ProposalBar proposal={draft.proposal} busy={busy} onAcceptClean={() => acceptClean.mutate()} />}

            <div className="pt-6">
              <DraftSheet />
            </div>
          </div>
        </div>
      </div>
      {dialogs}
    </DraftEditorContext.Provider>
  )
}
