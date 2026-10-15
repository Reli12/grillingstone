// A Grilling Session runs in its Project's folder and writes a Draft (first session) or a Proposal (later ones).
import type { Draft } from '#core/draft/draftTypes.ts'
import { parseGlossary } from '#core/glossary/glossary.ts'
import { draftMarkdown } from '#core/publish/draftMarkdown.ts'
import { acceptSubmission, type SubmissionOutcome } from '#core/session/acceptSubmission.ts'
import { buildSeed, type SeedInput } from '#core/session/grillingSeed.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'
import type { Template } from '#core/template/templateTypes.ts'

import type { Hub } from '../hub.ts'
import { iterationMeta, now } from '../services/clock.ts'
import type { DraftService } from '../services/draftService.ts'
import type { GlossaryService } from '../services/glossaryService.ts'
import { getDraft } from '../storage/drafts.ts'
import { getGlossary } from '../storage/glossary.ts'
import { projectDir } from '../storage/paths.ts'
import { getProject } from '../storage/projects.ts'
import { getTemplate } from '../storage/templates.ts'
import { saveTranscript } from '../storage/transcripts.ts'
import type { Assistant } from './assistant.ts'
import { SessionError } from './sessionError.ts'
import { type PreparedSession, type Scope, type SubmitResult, summaryOf } from './sessionScope.ts'

export interface StartArgs {
  projectId: string
  draftId: string
  kind: SessionKind
  focus?: { sectionId: string; entryId?: string }
  humanNote?: string
  /** For a Continuation: the ended session whose conversation it resumes (ADR-0014). */
  continues?: SessionSummary
  /** The Assistant that runs it. */
  assistant: Pick<Assistant, 'name' | 'submitVia'>
}

export interface GrillingDeps {
  hub: Hub
  drafts: DraftService
  glossary: GlossaryService
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
}

/** What a later session works on, as the intro names it. */
function laterSessionName(kind: SessionKind, focus: Focus, upgradeTo: Template | undefined) {
  if (kind === 'focused') return `Focused Session on ${focus!.heading}`
  if (kind === 'upgrade') return `Template upgrade to ${upgradeTo!.name} v${upgradeTo!.version}`
  return 'New Iteration on the whole Draft'
}

/** The first system line: what kind of session this is and what Claude has to work from. */
function grillingIntro({ args, draft, focus, upgradeTo, glossaryMarkdown, referenceCount }: IntroInput) {
  const terms = plural(parseGlossary(glossaryMarkdown).length, 'term')
  const referencesPart = referenceCount ? ` and ${plural(referenceCount, 'Reference')}` : ''
  const context = `the Glossary (${terms})${referencesPart}`
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

function grillingScope(args: StartArgs, deps: GrillingDeps, submit: Scope['submit']): Scope {
  const { projectId, draftId, kind } = args
  return {
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
type SeedMaterial = Pick<SeedInput, 'draft' | 'projectName' | 'glossary' | 'references' | 'upgradeTo'>

function seedFor(args: StartArgs, material: SeedMaterial) {
  return buildSeed({
    kind: args.kind,
    ...material,
    submitVia: args.assistant.submitVia,
    focus: args.focus,
    humanNote: args.humanNote,
    continuing: !!args.continues,
  })
}

function newTranscript(args: StartArgs, focus: Focus): Transcript {
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
    assistant: args.assistant.name,
    ...(continues ? { continues: continues.id, conversationId: continues.conversationId } : {}),
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

  const seed = seedFor(args, { draft, projectName: project.name, glossary: glossary.markdown, references, upgradeTo })
  const transcript = newTranscript(args, focus)
  const submit = grillingSubmitter(args, transcript.id, upgradeTo, deps)
  const intro = grillingIntro({
    args,
    draft,
    focus,
    upgradeTo,
    glossaryMarkdown: glossary.markdown,
    referenceCount: references.length,
  })

  return {
    transcript,
    seed,
    intro,
    ...(args.continues ? { resume: args.continues.conversationId } : {}),
    scope: grillingScope(args, deps, submit),
  }
}
