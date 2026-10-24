// Tests for DraftService: input checks on create, and announcing a Draft only when it actually changed.
import { beforeEach, describe, expect, it } from 'vitest'

import type { ServerEvent } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import type { Hub } from '../hub.ts'
import { createProject } from '../storage/projects.ts'
import { DraftInputError, DraftService } from './draftService.ts'

let events: ServerEvent[]
let service: DraftService

beforeEach(async () => {
  await resetTestData()
  events = []
  service = new DraftService({ broadcast: (event: ServerEvent) => void events.push(event) } as Hub)
})

describe('DraftService', () => {
  it('creates a Draft with only existing References and announces the list', async () => {
    const { id: projectId } = await createProject('P', 'azure-devops', meta.date)
    const first = await service.create(projectId, {
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: ' Archive ',
      references: [],
    })
    const second = await service.create(projectId, {
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: 'Bulk',
      references: [first.id, 'ghost'],
    })
    expect(first.requirement).toBe('Archive')
    expect(second.references).toEqual([first.id])
    expect(events).toEqual([
      { type: 'drafts', projectId },
      { type: 'drafts', projectId },
    ])
    await expect(
      service.create(projectId, {
        workItemType: 'Epic',
        templateId: defaultPbiTemplate.id,
        requirement: 'x',
        references: [],
      }),
    ).rejects.toThrow(DraftInputError)
  })

  it("writes a Draft only in a Template of the Project's Tracker", async () => {
    const { id: projectId } = await createProject('Jira P', 'jira', meta.date)
    const pbiInJira = {
      workItemType: 'PBI' as const,
      templateId: defaultPbiTemplate.id,
      requirement: 'x',
      references: [],
    }
    await expect(service.create(projectId, pbiInJira)).rejects.toThrow('is not a Jira Template')
    const story = await service.create(projectId, {
      ...pbiInJira,
      workItemType: 'Story',
      templateId: 'default-jira-story',
    })
    expect([story.workItemType, story.template.tracker]).toEqual(['Story', 'jira'])
  })

  it('announces a Draft only when it changed', async () => {
    const { id: projectId } = await createProject('P', 'azure-devops', meta.date)
    const draft = await service.create(projectId, {
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: 'x',
      references: [],
    })
    events.length = 0
    await service.update(projectId, draft.id, () => null)
    expect(events).toEqual([])
    await service.update(projectId, draft.id, (draft) => draft)
    expect(events).toEqual([])
    expect((await service.setReferences(projectId, draft.id, [draft.id])).references).toEqual([])
    events.length = 0
    await service.update(projectId, draft.id, (current) => ({ ...current, requirement: 'y' }))
    expect(events.map((event) => event.type)).toEqual(['draft', 'drafts'])
  })
})
