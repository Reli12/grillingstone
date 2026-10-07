// Props shared by the Draft sheet's Section and Entry components.
import type { Entry, Section } from '#core/draft/draftTypes.ts'
import type { Change } from '#core/proposal/proposalTypes.ts'

export interface EntryProps {
  section: Section
  entry: Entry
}

export interface EntriesProps {
  section: Section
  pending: Change[]
}

export interface SectionProps {
  section: Section
}
