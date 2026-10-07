import { describe, expect, it } from 'vitest'

import { templateFromSession } from '#core/template/templateFromSession.ts'

describe('templateFromSession', () => {
  it('keeps only Template fields, trims text and defaults the Iteration Log heading', () => {
    const t = templateFromSession(
      {
        name: ' Spike PBI ',
        method: ' # Method ',
        sections: [
          {
            key: 'goal',
            heading: ' Goal ',
            shape: 'prose',
            locked: true,
            guidance: ' Why ',
            target: 'System.Description',
            extra: 1,
          } as never,
          {
            key: 'acs',
            heading: 'ACs',
            shape: 'entries',
            locked: false,
            guidance: undefined as never,
            target: 'Microsoft.VSTS.Common.AcceptanceCriteria',
            entryFormat: 'gherkin',
          },
        ],
      },
      'PBI',
      '2026-09-23',
    )
    expect(t).toEqual({
      id: '',
      workItemType: 'PBI',
      name: 'Spike PBI',
      version: 1,
      isDefault: false,
      method: '# Method',
      iterationLogHeading: 'PBI Iteration Log',
      updatedAt: '2026-09-23',
      sections: [
        { key: 'goal', heading: 'Goal', shape: 'prose', locked: true, guidance: 'Why', target: 'System.Description' },
        {
          key: 'acs',
          heading: 'ACs',
          shape: 'entries',
          locked: false,
          guidance: '',
          target: 'Microsoft.VSTS.Common.AcceptanceCriteria',
          entryFormat: 'gherkin',
        },
      ],
    })
  })

  it('keeps the Iteration Log field the session chose', () => {
    const t = templateFromSession(
      {
        name: 'Team Bug',
        method: 'm',
        iterationLogTarget: 'Microsoft.VSTS.TCM.SystemInfo',
        sections: [
          {
            key: 'steps',
            heading: 'Steps',
            shape: 'entries',
            locked: true,
            guidance: '',
            target: 'Microsoft.VSTS.TCM.ReproSteps',
          },
        ],
      },
      'Bug',
      '2026-10-03',
    )
    expect(t.iterationLogTarget).toBe('Microsoft.VSTS.TCM.SystemInfo')
  })
})
