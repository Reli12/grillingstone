// The Published Snapshot: what Azure DevOps held for the Linked Work Item right after a Publish or link, and the
// Draft at that moment. Also what "the same content" means when Azure DevOps reformats HTML on save.
import type { PublishedSnapshot, SnapshotSection, WorkItemView } from '#core/ado/adoTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { htmlToMarkdown } from '#core/shared/htmlMarkdown.ts'
import { defaultIterationLogTarget } from '#core/shared/workItemType.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

/** Every field the Draft's Template Publishes into: its Sections' targets and the Iteration Log's. */
export function templateTargets(draft: Draft): string[] {
  const template = draft.template
  const log = template.iterationLogTarget ?? defaultIterationLogTarget(templateTracker(template), draft.workItemType)
  return [...new Set([...template.sections.map((section) => section.target), log])]
}

/** Two rich-text values say the same thing once Azure DevOps' own formatting is set aside. */
export const sameContent = (first: string | undefined, second: string | undefined) =>
  htmlToMarkdown(first ?? '') === htmlToMarkdown(second ?? '')

/** Two titles are the same once surrounding whitespace is set aside. */
export const sameTitle = (first: string, second: string) => first.trim() === second.trim()

/** The Draft's non-Discarded content, the part a Publish writes. */
export function draftSnapshot(draft: Draft): PublishedSnapshot['draft'] {
  const sections: SnapshotSection[] = draft.sections
    .filter((section) => !section.discarded)
    .map((section) => ({
      id: section.id,
      key: section.key,
      heading: section.heading,
      target: section.target,
      body: section.body,
      entries: section.entries
        .filter((entry) => !entry.discarded)
        .map((entry) => ({ id: entry.id, title: entry.title, body: entry.body })),
    }))
  return { title: draft.title, sections }
}

/** The item's Template fields as it holds them; a field it lacks is ''. */
export function itemFields(draft: Draft, item: WorkItemView): Record<string, string> {
  return Object.fromEntries(templateTargets(draft).map((target) => [target, item.fields[target] ?? '']))
}

export function publishedSnapshot(draft: Draft, item: WorkItemView, at: string): PublishedSnapshot {
  return { rev: item.rev, at, title: item.title, fields: itemFields(draft, item), draft: draftSnapshot(draft) }
}
