// Refusing a submitted Proposal before the human sees it: malformed changes, unknown targets, and results
// that would break the Template.
import { toContent } from '#core/draft/draft.ts'
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'
import { isTitledEntry, validate } from '#core/draft/draftValidator.ts'
import { applyChange } from '#core/proposal/applyChange.ts'
import type { ChangeKind, ProposedChange } from '#core/proposal/proposalTypes.ts'
import type { Reason } from '#core/shared/validation.ts'
import type { Template } from '#core/template/templateTypes.ts'

const KINDS: ChangeKind[] = ['retitle', 'replaceSection', 'replaceEntry', 'addEntry', 'restore', 'addSection']
const TEXT_FIELDS = ['label', 'sectionId', 'entryId', 'afterEntryId', 'sectionKey', 'title', 'body'] as const

const isTitledEntryList = (entries: unknown) => Array.isArray(entries) && (entries as unknown[]).every(isTitledEntry)

const isChange = (change: unknown): change is ProposedChange => {
  if (!change || typeof change !== 'object') return false
  const fields = change as Record<string, unknown>
  if (!KINDS.includes(fields.kind as ChangeKind)) return false
  const hasNonStringText = TEXT_FIELDS.some((name) => fields[name] !== undefined && typeof fields[name] !== 'string')
  if (hasNonStringText) return false
  if (fields.entries !== undefined && !isTitledEntryList(fields.entries)) return false
  return true
}

/** Applies every change to a copy of the Draft and validates the result against `template`. */
function checkResult(draft: Draft, changes: ProposedChange[], template: Template): Reason[] {
  let result: Draft = {
    ...draft,
    template,
    proposal: { id: 'check', sessionId: '', kind: 'iteration', createdAt: '', changes: [], upgradeTo: template },
  }
  for (const change of changes) result = applyChange(result, change)
  // The Template rules still hold, but after v1 the Section order is the human's: validate the
  // result in Template order so a Section they moved never blocks a Proposal.
  const content = toContent(result)
  const rank = (key: string) => template.sections.findIndex((def) => def.key === key)
  content.sections.sort((first, second) => rank(first.key) - rank(second.key))
  const validation = validate(template, content)
  return validation.ok ? [] : validation.reasons
}

type Refuse = (code: string, message: string) => Reason[]

function checkAddSection(draft: Draft, template: Template, change: ProposedChange, refuse: Refuse): Reason[] {
  const def = template.sections.find((sectionDef) => sectionDef.key === change.sectionKey)
  if (!def) return refuse('unknown-target', `no Template Section with key "${change.sectionKey}".`)
  if (draft.sections.some((section) => section.key === change.sectionKey))
    return refuse('duplicate-section', `the Draft already has "${def.heading}".`)
  return []
}

function checkAddEntry(section: Section, change: ProposedChange, refuse: Refuse): Reason[] {
  if (section.shape !== 'entries') return refuse('wrong-shape', `"${section.heading}" is prose — use replaceSection.`)
  const afterIsMissing = change.afterEntryId && !section.entries.some((other) => other.id === change.afterEntryId)
  if (afterIsMissing) return refuse('unknown-target', `no Entry "${change.afterEntryId}" to add after.`)
  const hasTitleAndBody = change.title?.trim() && change.body?.trim()
  return hasTitleAndBody ? [] : refuse('malformed-change', 'addEntry needs "title" and "body".')
}

/** Checks a change that targets an existing Section (and optionally one of its Entries) against that target. */
function checkSectionChange(
  kind: Exclude<ChangeKind, 'retitle' | 'addSection'>,
  section: Section,
  entry: Entry | undefined,
  change: ProposedChange,
  refuse: Refuse,
): Reason[] {
  switch (kind) {
    case 'replaceSection':
      if (section.shape !== 'prose')
        return refuse('wrong-shape', `"${section.heading}" holds Entries — use replaceEntry / addEntry.`)
      return typeof change.body === 'string' ? [] : refuse('malformed-change', 'replaceSection needs "body".')
    case 'replaceEntry':
      if (!entry) return refuse('unknown-target', 'replaceEntry needs "entryId".')
      return change.body?.trim() ? [] : refuse('malformed-change', 'replaceEntry needs a non-empty "body".')
    case 'addEntry':
      return checkAddEntry(section, change, refuse)
    case 'restore': {
      const target = entry ?? section
      if (target.discarded) return []
      return refuse('nothing-to-restore', `"${entry?.title ?? section.heading}" is not Discarded.`)
    }
  }
}

function checkTarget(draft: Draft, template: Template, change: ProposedChange, name: string): Reason[] {
  const refuse: Refuse = (code, message) => [{ code, message: `${name}: ${message}` }]
  if (change.kind === 'retitle')
    return change.title?.trim() ? [] : refuse('malformed-change', 'retitle needs a non-empty "title".')
  if (change.kind === 'addSection') return checkAddSection(draft, template, change, refuse)
  const section = draft.sections.find((candidate) => candidate.id === change.sectionId)
  if (!section) return refuse('unknown-target', `no Section with id "${change.sectionId}".`)
  const entry = change.entryId ? section.entries.find((candidate) => candidate.id === change.entryId) : undefined
  if (change.entryId && !entry) return refuse('unknown-target', `no Entry "${change.entryId}" in "${section.heading}".`)
  return checkSectionChange(change.kind, section, entry, change, refuse)
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
  proposed.forEach((change, i) => {
    const name = `Change ${i + 1}`
    if (!isChange(change)) {
      reasons.push({
        code: 'malformed-change',
        message: `${name}: "kind" must be one of ${KINDS.join(', ')}, with string fields.`,
      })
      return
    }
    reasons.push(...checkTarget(draft, template, change, name))
  })
  if (reasons.length) return reasons
  return checkResult(draft, proposed as ProposedChange[], template)
}
