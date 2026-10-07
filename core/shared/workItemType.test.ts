// Tests for the Azure DevOps fields each work item type may Publish into.
import { describe, expect, it } from 'vitest'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { allowedTargets, defaultIterationLogTarget, WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'

describe('Work Item Types', () => {
  it('are Epic, Feature, PBI, Task and Bug, in that order', () => {
    expect(WORK_ITEM_TYPES).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Bug'])
  })

  it('let Epics, Features and PBIs publish into Description and Acceptance Criteria', () => {
    for (const type of ['Epic', 'Feature', 'PBI'] as const)
      expect(allowedTargets(type)).toEqual([ADO_FIELDS.description, ADO_FIELDS.acceptanceCriteria])
  })

  it('let a Bug publish into Repro Steps, System Info and Acceptance Criteria — never the hidden Description', () => {
    expect(allowedTargets('Bug')).toEqual([ADO_FIELDS.reproSteps, ADO_FIELDS.systemInfo, ADO_FIELDS.acceptanceCriteria])
  })

  it('let a Task publish only into Description', () => {
    expect(allowedTargets('Task')).toEqual([ADO_FIELDS.description])
  })

  it('put the Iteration Log where the work item form shows it', () => {
    expect(defaultIterationLogTarget('Bug')).toBe(ADO_FIELDS.reproSteps)
    for (const type of ['Epic', 'Feature', 'PBI', 'Task'] as const)
      expect(defaultIterationLogTarget(type)).toBe(ADO_FIELDS.description)
  })
})
