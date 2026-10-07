// Applying one accepted change to the Draft.
import { newEntry, sectionFromContent } from '#core/draft/draft.ts'
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'
import type { ProposedChange } from '#core/proposal/proposalTypes.ts'

const mapSection = (draft: Draft, id: string | undefined, f: (s: Section) => Section): Draft => ({
  ...draft,
  sections: draft.sections.map((s) => (s.id === id ? f(s) : s)),
})
const mapEntry = (s: Section, id: string | undefined, f: (e: Entry) => Entry): Section => ({
  ...s,
  entries: s.entries.map((e) => (e.id === id ? f(e) : e)),
})

/** Applies one accepted change. What Claude wrote is no longer "edited by you"; positions the human chose stay. */
export function applyChange(draft: Draft, c: ProposedChange): Draft {
  switch (c.kind) {
    case 'retitle':
      return { ...draft, title: (c.title ?? draft.title).trim(), titleHumanEdited: false }
    case 'replaceSection':
      return mapSection(draft, c.sectionId, (s) => ({ ...s, body: c.body ?? s.body, humanEdited: false }))
    case 'replaceEntry':
      return mapSection(draft, c.sectionId, (s) =>
        mapEntry(s, c.entryId, (e) => ({
          ...e,
          title: c.title ?? e.title,
          body: c.body ?? e.body,
          humanEdited: false,
        })),
      )
    case 'addEntry':
      return mapSection(draft, c.sectionId, (s) => {
        const entries = [...s.entries]
        const at = entries.findIndex((e) => e.id === c.afterEntryId)
        entries.splice(at < 0 ? entries.length : at + 1, 0, newEntry(c.title ?? '', c.body ?? ''))
        return { ...s, entries, discarded: false }
      })
    case 'restore':
      return mapSection(draft, c.sectionId, (s) => {
        if (!c.entryId) return { ...s, discarded: false, body: c.body ?? s.body }
        return mapEntry(s, c.entryId, (e) => ({
          ...e,
          discarded: false,
          title: c.title ?? e.title,
          body: c.body ?? e.body,
        }))
      })
    case 'addSection': {
      const template = draft.proposal?.upgradeTo ?? draft.template
      if (!c.sectionKey || draft.sections.some((s) => s.key === c.sectionKey)) return draft
      const section = sectionFromContent(template, c.sectionKey, c.body, c.entries)
      const rank = (key: string) => template.sections.findIndex((d) => d.key === key)
      const sections = [...draft.sections]
      const before = sections.findIndex((s) => rank(s.key) > rank(section.key))
      sections.splice(before < 0 ? sections.length : before, 0, section)
      return { ...draft, sections }
    }
  }
}
