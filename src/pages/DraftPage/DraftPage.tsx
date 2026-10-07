// Layout D (prototype verdict): until v1 exists the session is a full-screen chat; from v1 on the chat
// sits left and the live Draft right. "Grill this" starts a Focused Session; Proposals render inline. An ended
// session can be continued from the chat (ADR-0014).
import { type ReactNode, type RefObject, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { BookOpenText, ClipboardCopy, Link2, Sparkles, Trash2 } from 'lucide-react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { LIVE_STATUSES, type SessionSummary, type Transcript } from '#core/session/sessionTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

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
import {
  type StartIntent,
  StartSessionDialog,
} from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import { DraftSheet } from '@/components/features/draft/draftSheet/draftSheet'
import { ProposalBar } from '@/components/features/draft/proposalBar/proposalBar'
import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
import { SESSION_TITLES } from '@/constants/SessionConstants'
import { DraftEditorContext, type DraftEditorValue } from '@/context/DraftEditor/DraftEditor'
import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

type Side = 'chat' | 'glossary'
type MobileView = 'chat' | 'draft'

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

/** Every mutation the page drives, so the parts of the page share one instance (and one pending state) each. */
function useDraftMutations(projectId: string, draftId: string) {
  return {
    op: useDraftOp(projectId, draftId),
    decide: useDecide(projectId, draftId),
    acceptClean: useAcceptAllClean(projectId, draftId),
    start: useStartSession(projectId, draftId),
    continueSession: useContinueSession(projectId, draftId),
    say: useSay(),
    writeNow: useWriteNow(),
    stop: useStopSession(),
    remove: useDeleteDraft(projectId),
  }
}

type DraftMutations = ReturnType<typeof useDraftMutations>

/** What the Draft sheet's Sections and Entries get through DraftEditorContext. */
function useDraftEditorValue(
  draft: Draft | undefined,
  live: SessionSummary | undefined,
  mutations: DraftMutations,
  onGrill: (intent: StartIntent) => void,
) {
  const { op, decide, acceptClean } = mutations
  const busy = op.isPending || decide.isPending || acceptClean.isPending
  return useMemo<DraftEditorValue | null>(
    () =>
      draft
        ? {
            draft,
            pending: draft.proposal?.changes.filter((change) => change.status === 'pending') ?? [],
            sessionRunning: !!live,
            busy,
            apply: (humanOp) => op.mutate(humanOp),
            decide: (changeId, accept) => decide.mutate({ changeId, accept }),
            grill: (target) => onGrill({ kind: 'focused', ...target }),
          }
        : null,
    [draft, live, busy, op, decide, onGrill],
  )
}

/** What deciding whether a session can be continued needs to know about it. */
type Continuable = Pick<Transcript, 'status' | 'claudeSessionId'>

/** The page's own UI state: which dialog, tab and side panel is showing, and what the chat continues. */
function useDraftPageUi() {
  const [intent, setIntent] = useState<StartIntent | null>(null)
  const [side, setSide] = useState<Side>('chat')
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [refsOpen, setRefsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('draft')
  /** The ended session the next message continues, instead of starting a new one. */
  const [continueFrom, setContinueFrom] = useState<Transcript | null>(null)
  /** A session just started: bring its chat into view, on small screens too. */
  const showChat = () => {
    setSide('chat')
    setMobileView('chat')
  }
  return {
    intent,
    setIntent,
    side,
    setSide,
    glossaryOpen,
    setGlossaryOpen,
    copyOpen,
    setCopyOpen,
    refsOpen,
    setRefsOpen,
    deleteOpen,
    setDeleteOpen,
    mobileView,
    setMobileView,
    continueFrom,
    setContinueFrom,
    showChat,
  }
}

type DraftPageUi = ReturnType<typeof useDraftPageUi>

interface IdleComposerProps {
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
function IdleComposer({
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
  const continuing = continueFrom
    ? { label: continuationLabel(continueFrom), onCancel: () => onContinueFromChange(null) }
    : undefined
  const offerLatest = latest && canContinue(latest) ? () => onContinueFromChange(latest) : undefined
  const { placeholder, hint } = idleComposerText(!!continueFrom, beforeV1)
  return (
    <NewSessionComposer
      starting={start.isPending || continueSession.isPending}
      onStart={startByTyping}
      blockedReason={draft.proposal ? PROPOSAL_OPEN_REASON : undefined}
      onContinueLatest={offerLatest}
      continuing={continuing}
      placeholder={placeholder}
      hint={hint}
    />
  )
}

interface ChatPaneProps extends Omit<IdleComposerProps, 'latest' | 'canContinue'> {
  live?: SessionSummary
  transcripts: Transcript[]
  composerRef: RefObject<HTMLTextAreaElement | null>
}

/** The session thread, and under it the live session's Composer or the idle message box. */
function ChatPane({ live, transcripts, composerRef, ...idleProps }: Readonly<ChatPaneProps>) {
  const { draft, mutations, onContinueFromChange } = idleProps
  const { say, writeNow, stop } = mutations
  // An ended session can be continued if Claude Code kept its conversation and nothing else is open.
  const canContinue = (transcript: Continuable) =>
    !live && !draft.proposal && !!transcript.claudeSessionId && !LIVE_STATUSES.includes(transcript.status)
  return (
    <>
      <ChatThread
        transcripts={transcripts}
        liveSessionId={live?.id}
        canContinue={canContinue}
        onContinue={(id) => onContinueFromChange(transcripts.find((transcript) => transcript.id === id) ?? null)}
        onAnswer={(sessionId, text) => say.mutate({ sessionId, text, kind: 'answer' })}
        onWrite={(sessionId) => writeNow.mutate(sessionId)}
        onAddSomething={() => composerRef.current?.focus()}
      />
      {live ? (
        <Composer
          ref={composerRef}
          session={live}
          sending={say.isPending}
          onSend={(text) => say.mutate({ sessionId: live.id, text, kind: 'message' })}
          onWriteNow={() => writeNow.mutate(live.id)}
          onStop={() => stop.mutate(live.id)}
        />
      ) : (
        <IdleComposer {...idleProps} latest={transcripts.at(-1)} canContinue={canContinue} />
      )}
    </>
  )
}

interface DraftDialogsProps {
  projectId: string
  draft: Draft
  mutations: DraftMutations
  ui: DraftPageUi
}

function DraftDialogs({ projectId, draft, mutations, ui }: Readonly<DraftDialogsProps>) {
  const navigate = useNavigate()
  const { start, remove } = mutations
  const { intent } = ui
  const startSession = (note: string) => {
    if (!intent) return
    const focus = intent.kind === 'focused' ? { focus: { sectionId: intent.sectionId, entryId: intent.entryId } } : {}
    const onSuccess = () => {
      ui.setIntent(null)
      ui.showChat()
    }
    start.mutate({ kind: intent.kind, ...focus, humanNote: note }, { onSuccess })
  }
  const onDelete = () => remove.mutate(draft.id, { onSuccess: () => void navigate(routesPaths.project(projectId)) })
  return (
    <>
      <StartSessionDialog
        // A fresh dialog (and an empty note) for every new intent.
        key={intent ? JSON.stringify(intent) : 'none'}
        intent={intent}
        onClose={() => ui.setIntent(null)}
        onStart={startSession}
        pending={start.isPending}
      />
      <CopyForAdo projectId={projectId} draftId={draft.id} open={ui.copyOpen} onClose={() => ui.setCopyOpen(false)} />
      <ReferencesDialog open={ui.refsOpen} onClose={() => ui.setRefsOpen(false)} draft={draft} />
      <DeleteDraftDialog open={ui.deleteOpen} onClose={() => ui.setDeleteOpen(false)} onDelete={onDelete} />
    </>
  )
}

interface LayoutProps {
  projectId: string
  projectName?: string
  draft: Draft
  live?: SessionSummary
  ui: DraftPageUi
  chat: ReactNode
  dialogs: ReactNode
}

function BeforeV1Header({ projectId, projectName, draft, live, ui }: Readonly<Omit<LayoutProps, 'chat' | 'dialogs'>>) {
  return (
    <header className="flex shrink-0 items-start gap-4 border-b border-line bg-sheet/70 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-faint">
          <Link to={routesPaths.project(projectId)} className="hover:text-ink">
            {projectName}
          </Link>
          , new {draft.workItemType} in the {draft.template.name}
        </p>
        <p className="mt-0.5 line-clamp-2 font-serif text-[17px] text-ink">{draft.requirement}</p>
      </div>
      <Button
        size="sm"
        variant={ui.glossaryOpen ? 'ink' : 'outline'}
        onClick={() => ui.setGlossaryOpen((wasOpen) => !wasOpen)}
        aria-pressed={ui.glossaryOpen}
      >
        <BookOpenText size={14} /> Glossary
      </Button>
      {!live && (
        <Button size="sm" variant="quiet" onClick={() => ui.setDeleteOpen(true)} aria-label="Delete Draft">
          <Trash2 size={14} />
        </Button>
      )}
    </header>
  )
}

/** Before v1: the session is a full-screen chat, with the Glossary on demand. */
function BeforeV1Layout({ chat, dialogs, ...headerProps }: Readonly<LayoutProps>) {
  const { projectId, projectName, ui } = headerProps
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <BeforeV1Header {...headerProps} />
        {chat}
      </div>
      {ui.glossaryOpen && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-sheet p-4">
          <h2 className="mb-3 font-serif text-lg font-semibold">{projectName} Glossary</h2>
          <GlossaryPanel projectId={projectId} compact />
        </aside>
      )}
      {dialogs}
    </div>
  )
}
interface MobileTabsProps {
  view: MobileView
  running: boolean
  onChange: (view: MobileView) => void
}

/** On small screens the Draft and the chat take turns; these tabs switch between them. */
function MobileTabs({ view, running, onChange }: Readonly<MobileTabsProps>) {
  const chatLabel = running ? 'Chat (running)' : 'Chat'
  return (
    <div className="flex shrink-0 border-b border-line bg-sheet p-1 lg:hidden" role="tablist">
      {(['draft', 'chat'] as const).map((option) => (
        <button
          key={option}
          role="tab"
          aria-selected={view === option}
          onClick={() => onChange(option)}
          className={cn(
            'h-8 flex-1 rounded-md text-sm font-medium',
            view === option ? 'bg-fog-deep text-ink' : 'text-ink-soft',
          )}
        >
          {option === 'draft' ? 'Draft' : chatLabel}
        </button>
      ))}
    </div>
  )
}

function SideTab({
  selected,
  onSelect,
  children,
}: Readonly<{ selected: boolean; onSelect: () => void; children: ReactNode }>) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'h-8 rounded-md px-3 text-sm',
        selected ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

interface SidePanelProps {
  projectId: string
  side: Side
  visible: boolean
  running: boolean
  chat: ReactNode
  onSideChange: (side: Side) => void
}

/** The left column from v1 on: the sessions or the Glossary. */
function SidePanel({ projectId, side, visible, running, chat, onSideChange }: Readonly<SidePanelProps>) {
  return (
    <aside className={cn('min-h-0 flex-1 flex-col border-r border-line lg:flex', visible ? 'flex' : 'hidden')}>
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2" role="tablist">
        <SideTab selected={side === 'chat'} onSelect={() => onSideChange('chat')}>
          Sessions
        </SideTab>
        <SideTab selected={side === 'glossary'} onSelect={() => onSideChange('glossary')}>
          Glossary
        </SideTab>
        {running && (
          <span className="ml-auto flex items-center gap-1.5 pr-1 text-[13px] text-claude">
            <span className="size-2 animate-pulse rounded-full bg-claude" /> Session running
          </span>
        )}
      </div>
      {side === 'chat' ? (
        chat
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <GlossaryPanel projectId={projectId} compact />
        </div>
      )}
    </aside>
  )
}

interface DraftToolbarProps {
  projectId: string
  projectName?: string
  draft: Draft
  running: boolean
  onReferences: () => void
  onDelete: () => void
  onCopy: () => void
}

/** Above the sheet: where this Draft sits, and References, Delete and Copy for Azure DevOps. */
function DraftToolbar({
  projectId,
  projectName,
  draft,
  running,
  onReferences,
  onDelete,
  onCopy,
}: Readonly<DraftToolbarProps>) {
  const referenceCount = draft.references.length
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <p className="text-[13px] text-ink-faint">
        <Link to={routesPaths.project(projectId)} className="hover:text-ink">
          {projectName}
        </Link>
        , {draft.workItemType} in the {draft.template.name} v{draft.template.version},{' '}
        <span className="font-medium text-ink">Draft v{draft.version}</span>
      </p>
      <span className="ml-auto" />
      <Button size="sm" variant="quiet" onClick={onReferences}>
        <Link2 size={14} /> References{referenceCount ? ` (${referenceCount})` : ''}
      </Button>
      <Button size="sm" variant="quiet" onClick={onDelete} disabled={running} aria-label="Delete Draft">
        <Trash2 size={14} />
      </Button>
      <Button size="sm" variant="ink" onClick={onCopy}>
        <ClipboardCopy size={14} /> Copy for Azure DevOps
      </Button>
    </div>
  )
}

function UpgradeBanner({
  latest,
  draft,
  onUpgrade,
}: Readonly<{ latest: Template; draft: Draft; onUpgrade: () => void }>) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-claude/30 bg-claude-wash px-4 py-2.5 text-sm">
      <Sparkles size={16} className="text-claude" />
      <span className="flex-1">
        {latest.name} is now at v{latest.version}; this Draft uses v{draft.template.version}.
      </span>
      <Button size="sm" variant="claude" onClick={onUpgrade}>
        Upgrade this Draft
      </Button>
    </div>
  )
}

/**
 * The newer version of the Draft's Template, when the Draft may upgrade to it: only a written Draft,
 * with no Proposal waiting and no session running.
 */
function upgradeTarget(draft: Draft, templates: Template[] | undefined, running: boolean) {
  const latest = templates?.find((template) => template.id === draft.template.id)
  const newer = latest && latest.version > draft.template.version
  if (draft.version > 0 && newer && !draft.proposal && !running) return latest
  return undefined
}

interface FromV1LayoutProps extends LayoutProps {
  /** The newer Template version on offer, if the Draft may upgrade. */
  upgradeTo?: Template
  busy: boolean
  onAcceptClean: () => void
}

/** From v1 on: the chat (or Glossary) on the left, the live Draft on the right. */
/** The right column: the toolbar, the upgrade offer, the open Proposal's bar, and the Draft sheet. */
function DraftColumn({
  projectId,
  projectName,
  draft,
  live,
  ui,
  upgradeTo,
  busy,
  onAcceptClean,
}: Readonly<Omit<FromV1LayoutProps, 'dialogs' | 'chat'>>) {
  const running = !!live
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto bg-sheet lg:block', ui.mobileView === 'draft' ? 'block' : 'hidden')}
    >
      <div className="px-4 pb-16 sm:px-10">
        <DraftToolbar
          projectId={projectId}
          projectName={projectName}
          draft={draft}
          running={running}
          onReferences={() => ui.setRefsOpen(true)}
          onDelete={() => ui.setDeleteOpen(true)}
          onCopy={() => ui.setCopyOpen(true)}
        />
        {upgradeTo && (
          <UpgradeBanner latest={upgradeTo} draft={draft} onUpgrade={() => ui.setIntent({ kind: 'upgrade' })} />
        )}
        {draft.proposal && <ProposalBar proposal={draft.proposal} busy={busy} onAcceptClean={onAcceptClean} />}
        <div className="pt-6">
          <DraftSheet />
        </div>
      </div>
    </div>
  )
}

function FromV1Layout(props: Readonly<Omit<FromV1LayoutProps, 'dialogs'>>) {
  const { projectId, live, ui, chat } = props
  const running = !!live
  return (
    <div className="flex h-full flex-col lg:grid lg:grid-cols-[minmax(360px,440px)_1fr]">
      <MobileTabs view={ui.mobileView} running={running} onChange={ui.setMobileView} />
      <SidePanel
        projectId={projectId}
        side={ui.side}
        visible={ui.mobileView === 'chat'}
        running={running}
        chat={chat}
        onSideChange={ui.setSide}
      />
      <DraftColumn {...props} />
    </div>
  )
}

/** Everything the page reads: the Draft with its live session, its Transcripts, the Project and the Templates. */
function useDraftPageData(projectId: string, draftId: string) {
  const { data, error } = useDraft(projectId, draftId)
  const { data: transcripts } = useTranscripts(projectId, draftId)
  const { data: project } = useProject(projectId)
  const { data: templates } = useTemplates()
  return { data, error, transcripts, project, templates }
}

export default function DraftPage() {
  const { projectId = '', draftId = '' } = useParams()
  const composer = useRef<HTMLTextAreaElement>(null)
  const ui = useDraftPageUi()

  const { data, error, transcripts, project, templates } = useDraftPageData(projectId, draftId)
  const mutations = useDraftMutations(projectId, draftId)

  const draft = data?.draft
  const live = data?.liveSession ?? undefined
  const editor = useDraftEditorValue(draft, live, mutations, ui.setIntent)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!draft || !transcripts || !editor) return <PageLoading />

  const chat = (
    <ChatPane
      draft={draft}
      live={live}
      transcripts={transcripts}
      mutations={mutations}
      composerRef={composer}
      continueFrom={ui.continueFrom}
      onContinueFromChange={ui.setContinueFrom}
      onShowChat={ui.showChat}
    />
  )
  const dialogs = <DraftDialogs projectId={projectId} draft={draft} mutations={mutations} ui={ui} />
  const layout = { projectId, projectName: project?.name, draft, live, ui, chat, dialogs }

  if (draft.version === 0) return <BeforeV1Layout {...layout} />
  return (
    <DraftEditorContext.Provider value={editor}>
      <FromV1Layout
        {...layout}
        upgradeTo={upgradeTarget(draft, templates, !!live)}
        busy={editor.busy}
        onAcceptClean={() => mutations.acceptClean.mutate()}
      />
      {dialogs}
    </DraftEditorContext.Provider>
  )
}
