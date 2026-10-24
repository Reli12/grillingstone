// Tests for each Tracker's Work Item Types and the fields each one's Sections may be copied into.
import { describe, expect, it } from 'vitest'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { customFieldTarget, fieldLabel, JIRA_FIELDS } from '#core/shared/trackerFields.ts'
import {
  acceptsCustomFields,
  allowedTargets,
  defaultIterationLogTarget,
  isTrackerType,
  workItemTypeHint,
  workItemTypes,
} from '#core/shared/workItemType.ts'

describe('Azure DevOps Work Item Types', () => {
  it('are Epic, Feature, PBI, Task and Bug, in that order', () => {
    expect(workItemTypes('azure-devops')).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Bug'])
  })

  it('let Epics, Features and PBIs publish into Description and Acceptance Criteria', () => {
    for (const type of ['Epic', 'Feature', 'PBI'] as const)
      expect(allowedTargets('azure-devops', type)).toEqual([ADO_FIELDS.description, ADO_FIELDS.acceptanceCriteria])
  })

  it('let a Bug publish into Repro Steps, System Info and Acceptance Criteria — never the hidden Description', () => {
    expect(allowedTargets('azure-devops', 'Bug')).toEqual([
      ADO_FIELDS.reproSteps,
      ADO_FIELDS.systemInfo,
      ADO_FIELDS.acceptanceCriteria,
    ])
  })

  it('let a Task publish only into Description', () => {
    expect(allowedTargets('azure-devops', 'Task')).toEqual([ADO_FIELDS.description])
  })

  it('put the Iteration Log where the work item form shows it', () => {
    expect(defaultIterationLogTarget('azure-devops', 'Bug')).toBe(ADO_FIELDS.reproSteps)
    for (const type of ['Epic', 'Feature', 'PBI', 'Task'] as const)
      expect(defaultIterationLogTarget('azure-devops', type)).toBe(ADO_FIELDS.description)
  })

  it('never take Custom Fields', () => {
    expect(acceptsCustomFields('azure-devops')).toBe(false)
  })
})

describe('Jira Work Item Types', () => {
  it('are Epic, Story, Task, Sub-task and Bug, in that order', () => {
    expect(workItemTypes('jira')).toEqual(['Epic', 'Story', 'Task', 'Sub-task', 'Bug'])
  })

  it('copy into Description only, except a Bug, which also has Environment', () => {
    for (const type of ['Epic', 'Story', 'Task', 'Sub-task'] as const)
      expect(allowedTargets('jira', type)).toEqual([JIRA_FIELDS.description])
    expect(allowedTargets('jira', 'Bug')).toEqual([JIRA_FIELDS.description, JIRA_FIELDS.environment])
  })

  it('append the Iteration Log to the Description', () => {
    for (const type of workItemTypes('jira'))
      expect(defaultIterationLogTarget('jira', type)).toBe(JIRA_FIELDS.description)
  })

  it('take Custom Fields', () => {
    expect(acceptsCustomFields('jira')).toBe(true)
  })

  it('describe a Task as standing on its own and a Sub-task as living inside another item', () => {
    expect(workItemTypeHint('jira', 'Task')).toMatch(/on its own/i)
    expect(workItemTypeHint('jira', 'Sub-task')).toMatch(/inside a Story, Task or Bug/i)
  })
})

describe('Which Tracker a type belongs to', () => {
  it('keeps Feature and PBI to Azure DevOps and Story and Sub-task to Jira', () => {
    expect(isTrackerType('azure-devops', 'PBI')).toBe(true)
    expect(isTrackerType('jira', 'PBI')).toBe(false)
    expect(isTrackerType('jira', 'Feature')).toBe(false)
    expect(isTrackerType('jira', 'Story')).toBe(true)
    expect(isTrackerType('azure-devops', 'Sub-task')).toBe(false)
  })
})

describe('Field labels', () => {
  it('name Azure DevOps, Jira and Custom Fields', () => {
    expect(fieldLabel(ADO_FIELDS.reproSteps)).toBe('Repro Steps')
    expect(fieldLabel(JIRA_FIELDS.environment)).toBe('Environment')
    expect(fieldLabel(customFieldTarget(' Acceptance Criteria '))).toBe('Acceptance Criteria')
  })
})
