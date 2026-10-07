// A Template Session runs in an empty working folder — no Project, no Glossary — and writes one new Template.
import type { TemplateRequest, TemplateTranscript } from '#core/session/sessionTypes.ts'
import { buildTemplateSeed } from '#core/session/templateSessionSeed.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'
import { templateFromSession } from '#core/template/templateFromSession.ts'
import { validateTemplate, type TemplateContent } from '#core/template/templateValidator.ts'
import { SUBMIT_SCRIPT } from '../config.ts'
import type { Hub } from '../hub.ts'
import { now } from '../services/clock.ts'
import type { TemplateService } from '../services/templateService.ts'
import { getTemplate } from '../storage/templates.ts'
import { makeTemplateSessionDir, saveTemplateTranscript } from '../storage/transcripts.ts'
import { SessionError } from './sessionError.ts'
import { summaryOf, type PreparedSession } from './sessionScope.ts'

export interface TemplateSessionDeps {
  hub: Hub
  templates: TemplateService
}

export async function prepareTemplateSession(request: TemplateRequest, deps: TemplateSessionDeps): Promise<PreparedSession<TemplateTranscript>> {
  if (!request.purpose.trim()) throw new SessionError('Say what the Template is for, so Claude has something to grill.')
  const base = request.baseTemplateId ? await getTemplate(request.baseTemplateId) : undefined
  if (base && base.workItemType !== request.workItemType) throw new SessionError(`"${base.name}" is not a ${request.workItemType} Template.`)

  const transcript: TemplateTranscript = {
    id: newId('tsess'),
    kind: 'template',
    request: { ...request, ...(base ? { baseTemplateName: base.name } : {}) },
    status: 'starting',
    writeConfirmed: false,
    startedAt: now(),
    messages: [],
  }

  const submit = async (payload: unknown) => {
    const result = validateTemplate(payload, { requireSkeleton: true, workItemType: request.workItemType })
    if (!result.ok) return { ok: false as const, reasons: result.reasons }
    const { workItemType } = request
    const template = await deps.templates.create(templateFromSession(payload as TemplateContent, workItemType, now()), { sessionId: transcript.id, at: now() })
    transcript.templateId = template.id
    return { ok: true as const, message: `Template "${template.name}" saved as your new ${workItemType} Template (${plural(template.sections.length, 'Section')}).` }
  }

  const material = [base && `the ${base.name} as a starting point`, request.examples.trim() && 'your example work items'].filter(Boolean).join(' and ')
  return {
    transcript,
    seed: buildTemplateSeed({ workItemType: request.workItemType, purpose: request.purpose, examples: request.examples, base, submitCommand: `node "${SUBMIT_SCRIPT}"` }),
    intro: `Template Session started for a new ${request.workItemType} Template.${material ? ` Claude has ${material}.` : ''} No Project or Glossary is involved.`,
    scope: {
      cwd: await makeTemplateSessionDir(transcript.id),
      guardMode: 'template',
      persist: false,
      save: (t) => saveTemplateTranscript(t as TemplateTranscript),
      emitMessage: (t, message) => deps.hub.broadcast({ type: 'templateMessage', sessionId: t.id, message }),
      emitSession: (t) => deps.hub.broadcast({ type: 'templateSession', session: summaryOf(t as TemplateTranscript) }),
      submit,
      submitLabel: 'Submitted the Template for validation',
    },
  }
}
