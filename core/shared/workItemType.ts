// The Work Item Types each Tracker defines, with the hint and copy fields each one gets.
// "Task" exists in both but means different things, so a type is always read with its Tracker.
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import type { Tracker } from '#core/shared/tracker.ts'
import { JIRA_FIELDS, type SectionTarget } from '#core/shared/trackerFields.ts'

/** Every type any Tracker defines, in the order pickers list them. */
export const WORK_ITEM_TYPES = ['Epic', 'Feature', 'PBI', 'Story', 'Task', 'Sub-task', 'Bug'] as const
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number]

const TRACKER_TYPES: Record<Tracker, readonly WorkItemType[]> = {
  'azure-devops': ['Epic', 'Feature', 'PBI', 'Task', 'Bug'],
  jira: ['Epic', 'Story', 'Task', 'Sub-task', 'Bug'],
}

export const isWorkItemType = (value: unknown): value is WorkItemType => WORK_ITEM_TYPES.includes(value as WorkItemType)

export const workItemTypes = (tracker: Tracker): readonly WorkItemType[] => TRACKER_TYPES[tracker]

export const isTrackerType = (tracker: Tracker, type: unknown): type is WorkItemType =>
  TRACKER_TYPES[tracker].includes(type as WorkItemType)

/** One line telling the human when to choose each type, in its Tracker's terms. */
const HINTS: Record<Tracker, Partial<Record<WorkItemType, string>>> = {
  'azure-devops': {
    Epic: 'A large business outcome, often with no requirements yet.',
    Feature: 'One capability with numbered business rules.',
    PBI: 'An implementation slice of a Feature, with testable ACs.',
    Task: 'A few hours of work inside a PBI or Bug, with a checkable done.',
    Bug: 'A defect someone has already observed, written so a developer can reproduce it.',
  },
  jira: {
    Epic: 'A large body of work that groups Stories, often with no requirements yet.',
    Story: 'One slice of user value, with testable ACs.',
    Task: 'A piece of work that stands on its own beside Stories, with a checkable done.',
    'Sub-task': 'A few hours of work inside a Story, Task or Bug, with a checkable done.',
    Bug: 'A defect someone has already observed, written so a developer can reproduce it.',
  },
}

export const workItemTypeHint = (tracker: Tracker, type: WorkItemType): string => HINTS[tracker][type] ?? ''

const ADO_BUILD_FIELDS: SectionTarget[] = [ADO_FIELDS.description, ADO_FIELDS.acceptanceCriteria]

/**
 * The system fields a Section may be copied into, per Tracker and type. Azure DevOps follows the Scrum
 * process, where a Bug's form hides Description; Jira puts everything in Description but a Bug's Environment.
 */
const TARGETS: Record<Tracker, Partial<Record<WorkItemType, SectionTarget[]>>> = {
  'azure-devops': {
    Epic: ADO_BUILD_FIELDS,
    Feature: ADO_BUILD_FIELDS,
    PBI: ADO_BUILD_FIELDS,
    Task: [ADO_FIELDS.description],
    Bug: [ADO_FIELDS.reproSteps, ADO_FIELDS.systemInfo, ADO_FIELDS.acceptanceCriteria],
  },
  jira: {
    Epic: [JIRA_FIELDS.description],
    Story: [JIRA_FIELDS.description],
    Task: [JIRA_FIELDS.description],
    'Sub-task': [JIRA_FIELDS.description],
    Bug: [JIRA_FIELDS.description, JIRA_FIELDS.environment],
  },
}

export const allowedTargets = (tracker: Tracker, type: WorkItemType): SectionTarget[] => TARGETS[tracker][type] ?? []

/** Only Jira teams add their own fields; Azure DevOps Templates stay on the Scrum process's fields. */
export const acceptsCustomFields = (tracker: Tracker) => tracker === 'jira'

/** Where a Template's Iteration Log goes when it names no field — always one the type's form shows. */
export function defaultIterationLogTarget(tracker: Tracker, type: WorkItemType): SectionTarget {
  if (tracker === 'jira') return JIRA_FIELDS.description
  return type === 'Bug' ? ADO_FIELDS.reproSteps : ADO_FIELDS.description
}
