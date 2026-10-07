import type { SectionTarget } from '#core/shared/adoFields.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

export type SectionShape = 'prose' | 'entries'

export interface TemplateSection {
  key: string
  heading: string
  shape: SectionShape
  locked: boolean
  /** One-line guidance for Claude and the human. */
  guidance: string
  target: SectionTarget
  /** 'gherkin' requires each Entry body to read Given … Then … */
  entryFormat?: 'gherkin'
}

export interface Template {
  id: string
  workItemType: WorkItemType
  name: string
  version: number
  isDefault: boolean
  sections: TemplateSection[]
  /** Writing method, markdown — travels with the Template (ADR-0007). */
  method: string
  /** Heading the Iteration Log is Published under, appended to the Description. */
  iterationLogHeading: string
  /** Field the Iteration Log is appended to; absent means the type's default (`defaultIterationLogTarget`). */
  iterationLogTarget?: SectionTarget
  updatedAt: string
  /** Set when a Template Session made it; local only — bundles leave it out. */
  origin?: { sessionId: string; at: string }
}
