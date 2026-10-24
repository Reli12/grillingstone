// The Azure DevOps fields this tool Publishes into, with their display labels.
/** Azure DevOps field reference names a Section can be Published into (ADR-0008). */
export const ADO_FIELDS = {
  title: 'System.Title',
  description: 'System.Description',
  acceptanceCriteria: 'Microsoft.VSTS.Common.AcceptanceCriteria',
  reproSteps: 'Microsoft.VSTS.TCM.ReproSteps',
  systemInfo: 'Microsoft.VSTS.TCM.SystemInfo',
} as const
export type AdoField = (typeof ADO_FIELDS)[keyof typeof ADO_FIELDS]
/** Every field some Section may be Published into — Title is the Draft's own, never a Section's. */
export const SECTION_TARGETS = [
  ADO_FIELDS.description,
  ADO_FIELDS.acceptanceCriteria,
  ADO_FIELDS.reproSteps,
  ADO_FIELDS.systemInfo,
] as const
export type AdoSectionTarget = (typeof SECTION_TARGETS)[number]
export const ADO_FIELD_LABELS: Record<string, string> = {
  [ADO_FIELDS.title]: 'Title',
  [ADO_FIELDS.description]: 'Description',
  [ADO_FIELDS.acceptanceCriteria]: 'Acceptance Criteria',
  [ADO_FIELDS.reproSteps]: 'Repro Steps',
  [ADO_FIELDS.systemInfo]: 'System Info',
}
