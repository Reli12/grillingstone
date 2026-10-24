// The fields a Section can be copied into, across both Trackers, and their labels.
// Azure DevOps fields are reference names; Jira's are its system fields or a Custom Field the human names.
import { ADO_FIELD_LABELS, type AdoSectionTarget } from '#core/shared/adoFields.ts'

/** Jira system fields this tool copies into. Summary is the Draft's title, never a Section's target. */
export const JIRA_FIELDS = {
  summary: 'summary',
  description: 'description',
  environment: 'environment',
} as const
export type JiraSystemTarget = typeof JIRA_FIELDS.description | typeof JIRA_FIELDS.environment

const CUSTOM_FIELD_PREFIX = 'custom:'
/** A field a Jira team added itself, stored with the name the human gave it (e.g. "custom:Acceptance Criteria"). */
export type CustomFieldTarget = `custom:${string}`

export type SectionTarget = AdoSectionTarget | JiraSystemTarget | CustomFieldTarget

export const customFieldTarget = (name: string): CustomFieldTarget => `${CUSTOM_FIELD_PREFIX}${name.trim()}`
export const isCustomFieldTarget = (target: string): target is CustomFieldTarget =>
  target.startsWith(CUSTOM_FIELD_PREFIX)
export const customFieldName = (target: CustomFieldTarget) => target.slice(CUSTOM_FIELD_PREFIX.length)

const JIRA_FIELD_LABELS: Record<string, string> = {
  [JIRA_FIELDS.summary]: 'Summary',
  [JIRA_FIELDS.description]: 'Description',
  [JIRA_FIELDS.environment]: 'Environment',
}

/** The name a human sees for a field; field ids never collide across Trackers, so no Tracker is needed. */
export function fieldLabel(target: string): string {
  if (isCustomFieldTarget(target)) return customFieldName(target)
  return ADO_FIELD_LABELS[target] ?? JIRA_FIELD_LABELS[target] ?? target
}
