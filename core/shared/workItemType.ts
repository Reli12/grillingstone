// The work item types a Draft can be, with the hint and Publish fields each one gets.
import { ADO_FIELDS, type SectionTarget } from '#core/shared/adoFields.ts'

export const WORK_ITEM_TYPES = ['Epic', 'Feature', 'PBI', 'Task', 'Bug'] as const
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number]

export const isWorkItemType = (value: unknown): value is WorkItemType => WORK_ITEM_TYPES.includes(value as WorkItemType)

/** One line telling the human when to choose this type. */
export const WORK_ITEM_TYPE_HINTS: Record<WorkItemType, string> = {
  Epic: 'A large business outcome, often with no requirements yet.',
  Feature: 'One capability with numbered business rules.',
  PBI: 'An implementation slice of a Feature, with testable ACs.',
  Task: 'A few hours of work inside a PBI or Bug, with a checkable done.',
  Bug: 'A defect someone has already observed, written so a developer can reproduce it.',
}

const BUILD_FIELDS: SectionTarget[] = [ADO_FIELDS.description, ADO_FIELDS.acceptanceCriteria]

/** The Azure DevOps fields a Section may be Published into, per type (Scrum process). A Bug's form hides Description. */
const TARGETS: Record<WorkItemType, SectionTarget[]> = {
  Epic: BUILD_FIELDS,
  Feature: BUILD_FIELDS,
  PBI: BUILD_FIELDS,
  Task: [ADO_FIELDS.description],
  Bug: [ADO_FIELDS.reproSteps, ADO_FIELDS.systemInfo, ADO_FIELDS.acceptanceCriteria],
}

export const allowedTargets = (type: WorkItemType): SectionTarget[] => TARGETS[type]

/** Where a Template's Iteration Log goes when it names no field — always one the type's form shows. */
export const defaultIterationLogTarget = (type: WorkItemType): SectionTarget =>
  type === 'Bug' ? ADO_FIELDS.reproSteps : ADO_FIELDS.description
