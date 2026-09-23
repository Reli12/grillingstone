/** Azure DevOps field reference names a Section can be Published into (ADR-0008). */
export const ADO_FIELDS = {
  title: 'System.Title',
  description: 'System.Description',
  acceptanceCriteria: 'Microsoft.VSTS.Common.AcceptanceCriteria',
} as const
export type AdoField = (typeof ADO_FIELDS)[keyof typeof ADO_FIELDS]
export const ADO_FIELD_LABELS: Record<string, string> = {
  [ADO_FIELDS.title]: 'Title',
  [ADO_FIELDS.description]: 'Description',
  [ADO_FIELDS.acceptanceCriteria]: 'Acceptance Criteria',
}
