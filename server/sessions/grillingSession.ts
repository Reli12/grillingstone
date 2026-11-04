// A Grilling Session runs in its Project's folder and writes a Draft (first session) or a Proposal (later ones).
import { deliverBacklogReferences, type DeliveredReference } from '#core/backlog/backlogDelivery.ts'
import { backlogReferencesOf, markBacklogSeen } from '#core/backlog/backlogReference.ts'
import type { CodeFolder, CodeFolderSnapshot } from '#core/codeFolder/codeFolderTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { parseGlossary } from '#core/glossary/glossary.ts'
import { draftMarkdown } from '#core/publish/draftMarkdown.ts'
import { acceptSubmission, type SubmissionOutcome } from '#core/session/acceptSubmission.ts'
import { submitPayloadFile } from '#core/session/cardProtocol.ts'
import { buildSeed, type SeededBacklogReference, type SeedInput } from '#core/session/grillingSeed.ts'
import type { ImageUpload } from '#core/session/images.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'
import type { Template } from '#core/template/templateTypes.ts'

import type { CodeFolderService } from '../codeFolders/codeFolderService.ts'
import { SUBMIT_SCRIPT } from '../config.ts'
import type { Hub } from '../hub.ts'
import { iterationMeta, now } from '../services/clock.ts'
import type { DraftService } from '../services/draftService.ts'
import type { GlossaryService } from '../services/glossaryService.ts'
import { findBacklogCopy } from '../storage/backlogCopies.ts'
import { getDraft } from '../storage/drafts.ts'
import { getGlossary } from '../storage/glossary.ts'
import { backlogCopySessionPath, projectDir } from '../storage/paths.ts'
import { getProject } from '../storage/projects.ts'
import { getTemplate } from '../storage/templates.ts'
import { saveTranscript } from '../storage/transcripts.ts'
import { SessionError } from './sessionError.ts'
import { type PreparedSession, type Scope, type SubmitResult, summaryOf } from './sessionScope.ts'

export interface StartArgs {
  projectId: string
  draftId: string
  kind: SessionKind
  focus?: { sectionId: string; entryId?: string }
  humanNote?: string
  /** "Include Backlog References in full": later sessions otherwise only get them listed (ADR-0015). */
  includeBacklogInFull?: boolean
  /** For a Continuation: the ended session whose Claude Code conversation it resumes (ADR-0014). */
  continues?: SessionSummary
  /** Images sent with the first message; the Supervisor saves and checks them. */
  images?: ImageUpload[]
  /** "Read Code Folders": absent means yes whenever the Project has any (ADR-0016). */
  readCodeFolders?: boolean
}

export interface GrillingDeps {
  hub: Hub
  drafts: DraftService
  glossary: GlossaryService
  /** Absent in tests that need no Code Folders. */
  codeFolders?: CodeFolderService
}

/** How much of the requirement stands in for a Reference that has no title yet. */
const UNTITLED_REFERENCE_LENGTH = 60

type Focus = SessionSummary['focus']
type Reference = SeedInput['references'][number]

/** The first session writes v1; every later one proposes changes to an existing, untriaged Draft. */
function checkKindFitsDraft(kind: SessionKind, draft: Draft) {
  if (kind === 'first' && draft.version !== 0)
    throw new SessionError('v1 already exists — start a Focused Session or a new Iteration instead.')
  if (kind !== 'first' && draft.version === 0)
    throw new SessionError('There is no Draft yet — the first session writes v1.')
  if (kind !== 'first' && draft.proposal)
    throw new SessionError('Triage the open Proposal before starting another session.')
}

/** The Section (and optionally Entry) a Focused Session grills, with the heading the chat shows for it. */
function focusOf(draft: Draft, requested: StartArgs['focus']): NonNullable<Focus> {
  const section = draft.sections.find((candidate) => candidate.id === requested?.sectionId)
  if (!section) throw new SessionError('Choose the Section to grill.')
  const entry = section.entries.find((candidate) => candidate.id === requested?.entryId)
  return {
    sectionId: section.id,
    ...(entry ? { entryId: entry.id } : {}),
    heading: entry ? `${section.heading} › ${entry.title}` : section.heading,
  }
}

/** The newer Template version an upgrade session moves the Draft to. */
async function upgradeTargetOf(draft: Draft): Promise<Template> {
  // A Template that no longer exists has nothing to upgrade to; that is reported just below.
  const latest = await getTemplate(draft.template.id).catch(() => undefined)
  if (!latest || latest.version <= draft.template.version)
    throw new SessionError('This Draft already uses the latest version of its Template.')
  return latest
}

/** The Draft's References as the seed shows them; a Reference that was deleted meanwhile is left out. */
async function loadReferences(projectId: string, draft: Draft): Promise<Reference[]> {
  const loaded = await Promise.all(
    draft.references.map((id) =>
      getDraft(projectId, id)
        .then((reference) => ({
          title: reference.title || reference.requirement.slice(0, UNTITLED_REFERENCE_LENGTH),
          workItemType: reference.workItemType,
          markdown: draftMarkdown(reference),
        }))
        // A deleted Reference is simply not passed on; the session can run without it.
        .catch(() => null),
    ),
  )
  return loaded.filter((reference) => reference !== null)
}

/**
 * The Draft's Backlog References as the delivery policy decides for this session, each with the path of its
 * readable file. A Copy deleted meanwhile is left out, as a deleted Reference is.
 */
async function loadBacklogReferences(args: StartArgs, draft: Draft): Promise<SeededBacklogReference[]> {
  const loaded = await Promise.all(
    backlogReferencesOf(draft).map(async ({ copyId, seenRevision }) => {
      const copy = await findBacklogCopy(args.projectId, copyId)
      return copy ? { copy, seenRevision } : null
    }),
  )
  const references = loaded.filter((reference) => reference !== null)
  const delivered = deliverBacklogReferences({
    kind: args.kind,
    includeInFull: !!args.includeBacklogInFull,
    references,
  })
  return delivered.map((reference) => ({ ...reference, path: backlogCopySessionPath(reference.copy.id) }))
}

/** "a", "a and b", "a, b and c". */
const andList = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/** "1 Backlog Reference in full" / "2 Backlog References (1 changed, in full, 1 listed)". */
function backlogPart(delivered: DeliveredReference[]) {
  if (!delivered.length) return ''
  const count = (mode: DeliveredReference['mode']) => delivered.filter((reference) => reference.mode === mode).length
  const parts = [
    [count('full'), 'in full'],
    [count('full-with-changes'), 'changed, in full'],
    [count('listed'), 'listed'],
  ].filter(([n]) => n) as [number, string][]
  const total = plural(delivered.length, 'Backlog Reference')
  if (parts.length === 1) return `${total} ${parts[0][1]}`
  return `${total} (${parts.map(([n, label]) => `${n} ${label}`).join(', ')})`
}

/** The Code Folders a session reads: those that exist now, their branch state, and the labels of missing ones. */
interface SessionCode {
  folders: CodeFolder[]
  snapshots: CodeFolderSnapshot[]
  missing: string[]
}

/**
 * What of the Project's code this session reads (ADR-0016): nothing when the human unticked "Read Code Folders"
 * or the Project has none; otherwise every folder that still exists, with its branch state read now — so a
 * Continuation sees the branch as it is today, not as it was.
 */
async function sessionCode(
  args: StartArgs,
  linked: CodeFolder[],
  deps: GrillingDeps,
): Promise<SessionCode | undefined> {
  const service = deps.codeFolders
  if (args.readCodeFolders === false || !linked.length || !service) return undefined
  const states = await Promise.all(linked.map((folder) => service.stateOf(folder)))
  const present = states.filter((state) => !state.missing)
  return {
    folders: linked.filter((folder) => present.some((state) => state.id === folder.id)),
    snapshots: present.map(({ label, branch, commit, uncommitted, onDefaultBranch, defaultBranch, inGit }) => ({
      label,
      branch,
      commit,
      uncommitted,
      onDefaultBranch,
      defaultBranch,
      inGit,
    })),
    missing: states.filter((state) => state.missing).map((state) => state.label),
  }
}

/** "app (main)", "ui-lib (spike, not develop, 3 uncommitted changes)", "docs (not in git)". */
function codeFolderPart(snapshot: CodeFolderSnapshot) {
  if (!snapshot.inGit) return `${snapshot.label} (not in git)`
  const parts = [snapshot.branch ?? `detached at ${snapshot.commit}`]
  if (!snapshot.onDefaultBranch) parts.push(`not ${snapshot.defaultBranch}`)
  if (snapshot.uncommitted) parts.push(plural(snapshot.uncommitted, 'uncommitted change'))
  return `${snapshot.label} (${parts.join(', ')})`
}

/** The intro's sentences about code: what Claude may read, and what is missing. */
function codeIntro(code: SessionCode | undefined) {
  if (!code) return ''
  const count = code.snapshots.length
  const read = count
    ? ` Claude may read the Code Folder${count === 1 ? '' : 's'} ${andList(code.snapshots.map(codeFolderPart))}.`
    : ''
  const one = code.missing.length === 1
  const missing = code.missing.length
    ? ` ${andList(code.missing)} ${one ? 'is' : 'are'} missing, so ${one ? 'it is' : 'they are'} skipped.`
    : ''
  return `${read}${missing}`
}

/** Checks and writes the submission inside the Draft's lock, so the Draft it checks is the one it writes. */
function grillingSubmitter(args: StartArgs, sessionId: string, upgradeTo: Template | undefined, deps: GrillingDeps) {
  const { projectId, draftId, kind } = args
  return async (payload: unknown): Promise<SubmitResult> => {
    const meta = await iterationMeta()
    const decided: { outcome?: SubmissionOutcome } = {}
    await deps.drafts.update(projectId, draftId, (draft) => {
      const outcome = (decided.outcome = acceptSubmission(draft, {
        kind,
        sessionId,
        payload,
        upgradeTo,
        meta,
        now: now(),
      }))
      return outcome.ok ? outcome.draft : null
    })
    const outcome = decided.outcome!
    return outcome.ok ? { ok: true as const, message: outcome.message } : outcome
  }
}

interface IntroInput {
  args: StartArgs
  draft: Draft
  focus: Focus
  upgradeTo: Template | undefined
  glossaryMarkdown: string
  referenceCount: number
  backlog: DeliveredReference[]
  code: SessionCode | undefined
}

/** What a later session works on, as the intro names it. */
function laterSessionName(kind: SessionKind, focus: Focus, upgradeTo: Template | undefined) {
  if (kind === 'focused') return `Focused Session on ${focus!.heading}`
  if (kind === 'upgrade') return `Template upgrade to ${upgradeTo!.name} v${upgradeTo!.version}`
  return 'New Iteration on the whole Draft'
}

/** The first system line: what kind of session this is and what Claude has to work from. */
function grillingIntro(input: IntroInput) {
  return `${baseIntro(input)}${codeIntro(input.code)}`
}

function baseIntro({ args, draft, focus, upgradeTo, glossaryMarkdown, referenceCount, backlog }: IntroInput) {
  const terms = plural(parseGlossary(glossaryMarkdown).length, 'term')
  const extras = [referenceCount ? plural(referenceCount, 'Reference') : '', backlogPart(backlog)].filter(Boolean)
  const context = andList([`the Glossary (${terms})`, ...extras])
  const what = laterSessionName(args.kind, focus, upgradeTo)
  const first = args.kind === 'first'
  if (args.continues && first)
    return `Continuing the earlier conversation. Claude remembers it, and has the requirement and ${context} as they are now.`
  if (args.continues)
    return `Continuing the earlier conversation as a ${what}. Claude remembers it, and has Draft v${draft.version} and ${context} as they are now. Claude will return a Proposal.`
  if (first)
    return `Grilling Session started for a new ${draft.workItemType} Draft in the ${draft.template.name}. Claude has the requirement and ${context}.`
  return `${what} started from Draft v${draft.version} and ${context}. Claude will return a Proposal.`
}

function grillingScope(
  args: StartArgs,
  deps: GrillingDeps,
  submit: Scope['submit'],
  code: SessionCode | undefined,
): Scope {
  const { projectId, draftId, kind } = args
  return {
    ...(code ? { codeFolders: code.folders } : {}),
    cwd: projectDir(projectId),
    guardMode: 'grilling',
    persist: true,
    save: (transcript) => saveTranscript(transcript as Transcript),
    emitMessage: (transcript, message) =>
      deps.hub.broadcast({ type: 'message', projectId, draftId, sessionId: transcript.id, message }),
    emitSession: (transcript) =>
      deps.hub.broadcast({ type: 'session', projectId, session: summaryOf(transcript as Transcript) }),
    submit,
    submitLabel: kind === 'first' ? 'Submitted the Draft for validation' : 'Submitted a Proposal for validation',
    onGlossaryEdit: () => deps.glossary.changedBySession(projectId),
  }
}

/** What the session starts from, beyond the request itself. */
type SeedMaterial = Pick<
  SeedInput,
  'draft' | 'projectName' | 'glossary' | 'references' | 'backlogReferences' | 'upgradeTo' | 'codeFolders'
>

function seedFor(args: StartArgs, sessionId: string, material: SeedMaterial) {
  return buildSeed({
    kind: args.kind,
    ...material,
    submitCommand: `node "${SUBMIT_SCRIPT}"`,
    payloadFile: submitPayloadFile(sessionId),
    focus: args.focus,
    humanNote: args.humanNote,
    continuing: !!args.continues,
  })
}

function newTranscript(args: StartArgs, focus: Focus, code: SessionCode | undefined): Transcript {
  const humanNote = args.humanNote?.trim()
  const { continues } = args
  return {
    id: newId('sess'),
    projectId: args.projectId,
    draftId: args.draftId,
    kind: args.kind,
    status: 'starting',
    ...(focus ? { focus } : {}),
    ...(humanNote ? { humanNote } : {}),
    ...(continues ? { continues: continues.id, claudeSessionId: continues.claudeSessionId } : {}),
    // A Continuation numbers its Images on from the session it continues.
    ...(continues?.lastImageNumber ? { lastImageNumber: continues.lastImageNumber } : {}),
    ...(code ? { codeFolders: code.snapshots } : {}),
    writeConfirmed: false,
    startedAt: now(),
    messages: [],
  }
}

export async function prepareGrillingSession(
  args: StartArgs,
  deps: GrillingDeps,
): Promise<PreparedSession<Transcript>> {
  const { projectId, draftId, kind } = args
  const [project, draft, glossary] = await Promise.all([
    getProject(projectId),
    getDraft(projectId, draftId),
    getGlossary(projectId),
  ])
  checkKindFitsDraft(kind, draft)
  const focus = kind === 'focused' ? focusOf(draft, args.focus) : undefined
  const upgradeTo = kind === 'upgrade' ? await upgradeTargetOf(draft) : undefined
  const references = await loadReferences(projectId, draft)
  const backlogReferences = await loadBacklogReferences(args, draft)
  const code = await sessionCode(args, project.codeFolders ?? [], deps)

  const transcript = newTranscript(args, focus, code)
  const material = {
    draft,
    projectName: project.name,
    glossary: glossary.markdown,
    references,
    backlogReferences,
    upgradeTo,
    ...(code ? { codeFolders: { folders: code.snapshots, missing: code.missing } } : {}),
  }
  const seed = seedFor(args, transcript.id, material)
  const submit = grillingSubmitter(args, transcript.id, upgradeTo, deps)
  const intro = grillingIntro({
    args,
    draft,
    focus,
    upgradeTo,
    glossaryMarkdown: glossary.markdown,
    referenceCount: references.length,
    backlog: backlogReferences,
    code,
  })
  // Once the seed has gone out its Copies were delivered, which is what the changed flag tracks: it clears even
  // if the session later ends without a submission.
  const delivered = backlogReferences.map((reference) => reference.copy)
  const onLaunched = delivered.length
    ? async () => {
        await deps.drafts.update(projectId, draftId, (current) => markBacklogSeen(current, delivered))
      }
    : undefined

  return {
    transcript,
    seed,
    intro,
    ...(args.continues ? { resume: args.continues.claudeSessionId } : {}),
    ...(args.images?.length ? { images: args.images } : {}),
    ...(onLaunched ? { onLaunched } : {}),
    scope: grillingScope(args, deps, submit, code),
  }
}
