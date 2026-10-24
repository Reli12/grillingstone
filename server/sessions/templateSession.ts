// A Template Session runs in an empty working folder — no Project, no Glossary — and writes one new Template.
import type { TemplateRequest, TemplateTranscript } from '#core/session/sessionTypes.ts'
import { buildTemplateSeed } from '#core/session/templateSessionSeed.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'
import { TRACKER_LABELS, trackerOrDefault } from '#core/shared/tracker.ts'
import { isTrackerType } from '#core/shared/workItemType.ts'
import { templateFromSession } from '#core/template/templateFromSession.ts'
import { type Template, templateTracker } from '#core/template/templateTypes.ts'
import { type TemplateContent, validateTemplate } from '#core/template/templateValidator.ts'

import { SUBMIT_SCRIPT } from '../config.ts'
import type { Hub } from '../hub.ts'
import { now } from '../services/clock.ts'
import type { TemplateService } from '../services/templateService.ts'
import { getTemplate } from '../storage/templates.ts'
import { makeTemplateSessionDir, saveTemplateTranscript } from '../storage/transcripts.ts'
import { SessionError } from './sessionError.ts'
import { type PreparedSession, type Scope, type SubmitResult, summaryOf } from './sessionScope.ts'

export interface TemplateSessionDeps {
  hub: Hub
  templates: TemplateService
}

/** Validates the submitted Template and saves it as the human's own, remembering which session made it. */
function templateSubmitter(request: TemplateRequest, transcript: TemplateTranscript, deps: TemplateSessionDeps) {
  return async (payload: unknown): Promise<SubmitResult> => {
    const { workItemType } = request
    const tracker = trackerOrDefault(request.tracker)
    const result = validateTemplate(payload, { requireSkeleton: true, tracker, workItemType })
    if (!result.ok) return { ok: false as const, reasons: result.reasons }
    const content = templateFromSession(payload as TemplateContent, { tracker, workItemType }, now())
    const template = await deps.templates.create(content, { sessionId: transcript.id, at: now() })
    transcript.templateId = template.id
    const sections = plural(template.sections.length, 'Section')
    return {
      ok: true as const,
      message: `Template "${template.name}" saved as your new ${workItemType} Template (${sections}).`,
    }
  }
}

/** The first system line: what Claude starts from, if anything. */
function templateIntro(request: TemplateRequest, base: Template | undefined) {
  const material = [
    base && `the ${base.name} as a starting point`,
    request.examples.trim() && 'your example work items',
  ]
    .filter(Boolean)
    .join(' and ')
  const startingPoint = material ? ` Claude has ${material}.` : ''
  return `Template Session started for a new ${request.workItemType} Template.${startingPoint} No Project or Glossary is involved.`
}

function templateScope(cwd: string, deps: TemplateSessionDeps, submit: Scope['submit']): Scope {
  return {
    cwd,
    guardMode: 'template',
    persist: false,
    save: (transcript) => saveTemplateTranscript(transcript as TemplateTranscript),
    emitMessage: (transcript, message) =>
      deps.hub.broadcast({ type: 'templateMessage', sessionId: transcript.id, message }),
    emitSession: (transcript) =>
      deps.hub.broadcast({ type: 'templateSession', session: summaryOf(transcript as TemplateTranscript) }),
    submit,
    submitLabel: 'Submitted the Template for validation',
  }
}

export async function prepareTemplateSession(
  request: TemplateRequest,
  deps: TemplateSessionDeps,
): Promise<PreparedSession<TemplateTranscript>> {
  if (!request.purpose.trim()) throw new SessionError('Say what the Template is for, so Claude has something to grill.')
  const base = request.baseTemplateId ? await getTemplate(request.baseTemplateId) : undefined
  if (base && base.workItemType !== request.workItemType)
    throw new SessionError(`"${base.name}" is not a ${request.workItemType} Template.`)
  // A session that starts from a Template keeps that Template's Tracker.
  const tracker = base ? templateTracker(base) : trackerOrDefault(request.tracker)
  if (!isTrackerType(tracker, request.workItemType))
    throw new SessionError(`${TRACKER_LABELS[tracker]} has no ${String(request.workItemType)} Work Item Type.`)

  const transcript: TemplateTranscript = {
    id: newId('tsess'),
    kind: 'template',
    request: { ...request, tracker, ...(base ? { baseTemplateName: base.name } : {}) },
    status: 'starting',
    writeConfirmed: false,
    startedAt: now(),
    messages: [],
  }

  const seed = buildTemplateSeed({
    tracker,
    workItemType: request.workItemType,
    purpose: request.purpose,
    examples: request.examples,
    base,
    submitCommand: `node "${SUBMIT_SCRIPT}"`,
  })
  const intro = templateIntro(request, base)
  const cwd = await makeTemplateSessionDir(transcript.id)
  return {
    transcript,
    seed,
    intro,
    scope: templateScope(cwd, deps, templateSubmitter(transcript.request, transcript, deps)),
  }
}
