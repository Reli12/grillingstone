// Building a Draft: a new one before grilling, v1 from the first session's content, and back to content.
import type { Draft, DraftContent, Entry, Section } from '#core/draft/draftTypes.ts'
import { newId } from '#core/shared/ids.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

export interface IterationMeta {
  date: string
  author: string
}

export function newDraft(args: {
  projectId: string
  workItemType: WorkItemType
  template: Template
  requirement: string
  references?: string[]
  createdFromPrototypeId?: string
  now: string
}): Draft {
  return {
    id: newId('d'),
    projectId: args.projectId,
    workItemType: args.workItemType,
    title: '',
    titleHumanEdited: false,
    version: 0,
    requirement: args.requirement,
    references: args.references ?? [],
    template: args.template,
    sections: [],
    iterationLog: [],
    proposal: null,
    ...(args.createdFromPrototypeId ? { createdFromPrototypeId: args.createdFromPrototypeId } : {}),
    createdAt: args.now,
    updatedAt: args.now,
  }
}

export const newEntry = (title: string, body: string): Entry => ({
  id: newId('e'),
  title: title.trim(),
  body: body.trim(),
  discarded: false,
  humanEdited: false,
  humanMoved: false,
})

/** Builds a Section for a Template Section key from submitted content (content must already be validated). */
export function sectionFromContent(
  template: Template,
  key: string,
  body = '',
  entries: { title: string; body: string }[] = [],
): Section {
  const def = template.sections.find((sectionDef) => sectionDef.key === key)
  if (!def) throw new Error(`Unknown Section key ${key}`)
  return {
    id: newId('s'),
    key: def.key,
    heading: def.heading,
    shape: def.shape,
    locked: def.locked,
    target: def.target,
    guidance: def.guidance,
    ...(def.entryFormat ? { entryFormat: def.entryFormat } : {}),
    body: body.trim(),
    entries: def.shape === 'entries' ? entries.map((entry) => newEntry(entry.title, entry.body)) : [],
    discarded: false,
    humanEdited: false,
    humanMoved: false,
  }
}

/** The first session writes v1 directly (ADR-0005). Content must already be validated. */
export function writeV1(draft: Draft, content: DraftContent, meta: IterationMeta): Draft {
  if (draft.version !== 0) throw new Error('v1 already exists — later sessions return a Proposal')
  return {
    ...draft,
    title: content.title.trim(),
    version: 1,
    sections: content.sections.map((section) =>
      sectionFromContent(draft.template, section.key, section.body, section.entries),
    ),
    iterationLog: [{ version: 1, date: meta.date, author: meta.author, note: 'First Draft written' }],
    updatedAt: meta.date,
  }
}

/** The Draft as submittable content — used to re-validate a Draft with a Proposal applied. */
export function toContent(draft: Draft): DraftContent {
  return {
    title: draft.title,
    sections: draft.sections.map((section) => {
      if (section.shape !== 'entries') return { key: section.key, body: section.body }
      const entries = section.entries.map((entry) => ({ title: entry.title, body: entry.body }))
      return { key: section.key, body: section.body, entries }
    }),
  }
}
