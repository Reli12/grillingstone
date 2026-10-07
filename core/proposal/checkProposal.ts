// Refusing a submitted Proposal before the human sees it: malformed changes, unknown targets, and results
// that would break the Template.
import { toContent } from '#core/draft/draft.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { isTitledEntry, validate } from '#core/draft/draftValidator.ts'
import { applyChange } from '#core/proposal/applyChange.ts'
import type { ChangeKind, ProposedChange } from '#core/proposal/proposalTypes.ts'
import type { Reason } from '#core/shared/validation.ts'
import type { Template } from '#core/template/templateTypes.ts'

const KINDS: ChangeKind[] = ['retitle', 'replaceSection', 'replaceEntry', 'addEntry', 'restore', 'addSection']
const TEXT_FIELDS = ['label', 'sectionId', 'entryId', 'afterEntryId', 'sectionKey', 'title', 'body'] as const

const isChange = (c: unknown): c is ProposedChange => {
  if (!c || typeof c !== 'object') return false
  const r = c as Record<string, unknown>
  if (!KINDS.includes(r.kind as ChangeKind)) return false
  if (TEXT_FIELDS.some((f) => r[f] !== undefined && typeof r[f] !== 'string')) return false
  if (r.entries !== undefined && !(Array.isArray(r.entries) && (r.entries as unknown[]).every(isTitledEntry)))
    return false
  return true
}

/**
 * Refusal reasons for a submitted Proposal, empty when it may be shown to the human.
 * `template` is the Template the result must satisfy (the newer version for an upgrade).
 */
export function checkProposal(draft: Draft, proposed: unknown, template: Template = draft.template): Reason[] {
  if (!Array.isArray(proposed))
    return [{ code: 'malformed-proposal', message: 'Expected { "changes": [ … ] } with an array of changes.' }]
  if (proposed.length === 0)
    return [
      {
        code: 'empty-proposal',
        message: 'The Proposal has no changes. If nothing should change, tell the human in chat instead of submitting.',
      },
    ]

  const reasons: Reason[] = []
  proposed.forEach((c, i) => {
    const n = `Change ${i + 1}`
    if (!isChange(c)) {
      reasons.push({
        code: 'malformed-change',
        message: `${n}: "kind" must be one of ${KINDS.join(', ')}, with string fields.`,
      })
      return
    }
    reasons.push(...checkTarget(draft, template, c, n))
  })
  if (reasons.length) return reasons

  let result: Draft = {
    ...draft,
    template,
    proposal: { id: 'check', sessionId: '', kind: 'iteration', createdAt: '', changes: [], upgradeTo: template },
  }
  for (const c of proposed as ProposedChange[]) result = applyChange(result, c)
  // The Template rules still hold, but after v1 the Section order is the human's: validate the
  // result in Template order so a Section they moved never blocks a Proposal.
  const content = toContent(result)
  const rank = (key: string) => template.sections.findIndex((d) => d.key === key)
  content.sections.sort((a, b) => rank(a.key) - rank(b.key))
  const validation = validate(template, content)
  return validation.ok ? [] : validation.reasons
}

function checkTarget(draft: Draft, template: Template, c: ProposedChange, n: string): Reason[] {
  const refuse = (code: string, message: string): Reason[] => [{ code, message: `${n}: ${message}` }]
  if (c.kind === 'retitle')
    return c.title?.trim() ? [] : refuse('malformed-change', 'retitle needs a non-empty "title".')
  if (c.kind === 'addSection') {
    const def = template.sections.find((d) => d.key === c.sectionKey)
    if (!def) return refuse('unknown-target', `no Template Section with key "${c.sectionKey}".`)
    if (draft.sections.some((s) => s.key === c.sectionKey))
      return refuse('duplicate-section', `the Draft already has "${def.heading}".`)
    return []
  }
  const section = draft.sections.find((s) => s.id === c.sectionId)
  if (!section) return refuse('unknown-target', `no Section with id "${c.sectionId}".`)
  const entry = c.entryId ? section.entries.find((e) => e.id === c.entryId) : undefined
  if (c.entryId && !entry) return refuse('unknown-target', `no Entry "${c.entryId}" in "${section.heading}".`)

  switch (c.kind) {
    case 'replaceSection':
      if (section.shape !== 'prose')
        return refuse('wrong-shape', `"${section.heading}" holds Entries — use replaceEntry / addEntry.`)
      return typeof c.body === 'string' ? [] : refuse('malformed-change', 'replaceSection needs "body".')
    case 'replaceEntry':
      if (!entry) return refuse('unknown-target', 'replaceEntry needs "entryId".')
      return c.body?.trim() ? [] : refuse('malformed-change', 'replaceEntry needs a non-empty "body".')
    case 'addEntry':
      if (section.shape !== 'entries')
        return refuse('wrong-shape', `"${section.heading}" is prose — use replaceSection.`)
      if (c.afterEntryId && !section.entries.some((e) => e.id === c.afterEntryId))
        return refuse('unknown-target', `no Entry "${c.afterEntryId}" to add after.`)
      return c.title?.trim() && c.body?.trim() ? [] : refuse('malformed-change', 'addEntry needs "title" and "body".')
    case 'restore':
      return (entry ?? section).discarded
        ? []
        : refuse('nothing-to-restore', `"${entry?.title ?? section.heading}" is not Discarded.`)
  }
}
