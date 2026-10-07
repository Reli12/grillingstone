// Applying one accepted change to the Draft.
import { newEntry, sectionFromContent } from '#core/draft/draft.ts'
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'
import type { ProposedChange } from '#core/proposal/proposalTypes.ts'

const mapSection = (draft: Draft, id: string | undefined, edit: (section: Section) => Section): Draft => ({
  ...draft,
  sections: draft.sections.map((section) => (section.id === id ? edit(section) : section)),
})
const mapEntry = (section: Section, id: string | undefined, edit: (entry: Entry) => Entry): Section => ({
  ...section,
  entries: section.entries.map((entry) => (entry.id === id ? edit(entry) : entry)),
})

/** Inserts a new Entry after `afterEntryId`, or at the end when that Entry is not found. */
function addEntry(section: Section, change: ProposedChange): Section {
  const entries = [...section.entries]
  const after = entries.findIndex((entry) => entry.id === change.afterEntryId)
  const insertAt = after < 0 ? entries.length : after + 1
  entries.splice(insertAt, 0, newEntry(change.title ?? '', change.body ?? ''))
  return { ...section, entries, discarded: false }
}

/** Brings back a Discarded Section, or one of its Entries when the change names an Entry. */
function restore(section: Section, change: ProposedChange): Section {
  if (!change.entryId) return { ...section, discarded: false, body: change.body ?? section.body }
  return mapEntry(section, change.entryId, (entry) => ({
    ...entry,
    discarded: false,
    title: change.title ?? entry.title,
    body: change.body ?? entry.body,
  }))
}

/** Adds a Template Section the Draft lacks, placed before the first Section that comes after it in the Template. */
function addSection(draft: Draft, change: ProposedChange): Draft {
  const template = draft.proposal?.upgradeTo ?? draft.template
  if (!change.sectionKey || draft.sections.some((section) => section.key === change.sectionKey)) return draft
  const added = sectionFromContent(template, change.sectionKey, change.body, change.entries)
  const rank = (key: string) => template.sections.findIndex((def) => def.key === key)
  const sections = [...draft.sections]
  const before = sections.findIndex((section) => rank(section.key) > rank(added.key))
  sections.splice(before < 0 ? sections.length : before, 0, added)
  return { ...draft, sections }
}

/** Applies one accepted change. What Claude wrote is no longer "edited by you"; positions the human chose stay. */
export function applyChange(draft: Draft, change: ProposedChange): Draft {
  switch (change.kind) {
    case 'retitle':
      return { ...draft, title: (change.title ?? draft.title).trim(), titleHumanEdited: false }
    case 'replaceSection':
      return mapSection(draft, change.sectionId, (section) => ({
        ...section,
        body: change.body ?? section.body,
        humanEdited: false,
      }))
    case 'replaceEntry':
      return mapSection(draft, change.sectionId, (section) =>
        mapEntry(section, change.entryId, (entry) => ({
          ...entry,
          title: change.title ?? entry.title,
          body: change.body ?? entry.body,
          humanEdited: false,
        })),
      )
    case 'addEntry':
      return mapSection(draft, change.sectionId, (section) => addEntry(section, change))
    case 'restore':
      return mapSection(draft, change.sectionId, (section) => restore(section, change))
    case 'addSection':
      return addSection(draft, change)
  }
}
