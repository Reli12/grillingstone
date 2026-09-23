// A Grilling Session runs in its Project's folder and writes a Draft (first session) or a Proposal (later ones).
import { parseGlossary } from '#core/glossary/glossary.ts'
import { draftMarkdown } from '#core/publish/draftMarkdown.ts'
import { acceptSubmission, type SubmissionOutcome } from '#core/session/acceptSubmission.ts'
import { buildSeed } from '#core/session/grillingSeed.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { SessionSummary, Transcript } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { SUBMIT_SCRIPT } from '../config.ts'
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
import { SessionError } from './sessionError.ts'
import { summaryOf, type PreparedSession } from './sessionScope.ts'

export interface StartArgs {
  projectId: string
  draftId: string
  kind: SessionKind
  focus?: { sectionId: string; entryId?: string }
  humanNote?: string
  /** For a Continuation: the ended session whose Claude Code conversation it resumes (ADR-0014). */
  continues?: SessionSummary
}

export interface GrillingDeps {
  hub: Hub
  drafts: DraftService
  glossary: GlossaryService
}

export async function prepareGrillingSession(args: StartArgs, deps: GrillingDeps): Promise<PreparedSession<Transcript>> {
  const { projectId, draftId, kind } = args
  const [project, draft, glossary] = await Promise.all([getProject(projectId), getDraft(projectId, draftId), getGlossary(projectId)])

  if (kind === 'first' && draft.version !== 0) throw new SessionError('v1 already exists — start a Focused Session or a new Iteration instead.')
  if (kind !== 'first' && draft.version === 0) throw new SessionError('There is no Draft yet — the first session writes v1.')
  if (kind !== 'first' && draft.proposal) throw new SessionError('Triage the open Proposal before starting another session.')

  let focus: SessionSummary['focus']
  if (kind === 'focused') {
    const section = draft.sections.find((s) => s.id === args.focus?.sectionId)
    if (!section) throw new SessionError('Choose the Section to grill.')
    const entry = section.entries.find((e) => e.id === args.focus?.entryId)
    focus = { sectionId: section.id, ...(entry ? { entryId: entry.id } : {}), heading: entry ? `${section.heading} › ${entry.title}` : section.heading }
  }

  let upgradeTo: Template | undefined
  if (kind === 'upgrade') {
    upgradeTo = await getTemplate(draft.template.id).catch(() => undefined)
    if (!upgradeTo || upgradeTo.version <= draft.template.version) throw new SessionError('This Draft already uses the latest version of its Template.')
  }

  const references = (
    await Promise.all(
      draft.references.map((id) =>
        getDraft(projectId, id)
          .then((r) => ({ title: r.title || r.requirement.slice(0, 60), workItemType: r.workItemType, markdown: draftMarkdown(r) }))
          .catch(() => null),
      ),
    )
  ).filter((r) => r !== null)

  const seed = buildSeed({
    kind,
    draft,
    projectName: project.name,
    glossary: glossary.markdown,
    references,
    submitCommand: `node "${SUBMIT_SCRIPT}"`,
    focus: args.focus,
    humanNote: args.humanNote,
    upgradeTo,
    continuing: !!args.continues,
  })

  const transcript: Transcript = {
    id: newId('sess'),
    projectId,
    draftId,
    kind,
    status: 'starting',
    ...(focus ? { focus } : {}),
    ...(args.humanNote?.trim() ? { humanNote: args.humanNote.trim() } : {}),
    ...(args.continues ? { continues: args.continues.id, claudeSessionId: args.continues.claudeSessionId } : {}),
    writeConfirmed: false,
    startedAt: now(),
    messages: [],
  }

  const submit = async (payload: unknown) => {
    const meta = await iterationMeta()
    // Decided inside the Draft's lock, so the Draft it checks is the one it writes.
    const decided: { outcome?: SubmissionOutcome } = {}
    await deps.drafts.update(projectId, draftId, (d) => {
      const outcome = (decided.outcome = acceptSubmission(d, { kind, sessionId: transcript.id, payload, upgradeTo, meta, now: now() }))
      return outcome.ok ? outcome.draft : null
    })
    const outcome = decided.outcome!
    return outcome.ok ? { ok: true as const, message: outcome.message } : outcome
  }

  const terms = parseGlossary(glossary.markdown).length
  const context = `the Glossary (${plural(terms, 'term')})${references.length ? ` and ${plural(references.length, 'Reference')}` : ''}`
  const what = kind === 'focused' ? `Focused Session on ${focus!.heading}` : kind === 'upgrade' ? `Template upgrade to ${upgradeTo!.name} v${upgradeTo!.version}` : 'New Iteration on the whole Draft'
  const intro = args.continues
    ? kind === 'first'
      ? `Continuing the earlier conversation. Claude remembers it, and has the requirement and ${context} as they are now.`
      : `Continuing the earlier conversation as a ${what}. Claude remembers it, and has Draft v${draft.version} and ${context} as they are now. Claude will return a Proposal.`
    : kind === 'first'
      ? `Grilling Session started for a new ${draft.workItemType} Draft in the ${draft.template.name}. Claude has the requirement and ${context}.`
      : `${what} started from Draft v${draft.version} and ${context}. Claude will return a Proposal.`

  return {
    transcript,
    seed,
    intro,
    ...(args.continues ? { resume: args.continues.claudeSessionId } : {}),
    scope: {
      cwd: projectDir(projectId),
      guardMode: 'grilling',
      persist: true,
      save: (t) => saveTranscript(t as Transcript),
      emitMessage: (t, message) => deps.hub.broadcast({ type: 'message', projectId, draftId, sessionId: t.id, message }),
      emitSession: (t) => deps.hub.broadcast({ type: 'session', projectId, session: summaryOf(t as Transcript) }),
      submit,
      submitLabel: kind === 'first' ? 'Submitted the Draft for validation' : 'Submitted a Proposal for validation',
      onGlossaryEdit: () => deps.glossary.changedBySession(projectId),
    },
  }
}
