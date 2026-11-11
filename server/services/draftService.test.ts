// Tests for DraftService: input checks on create, announcing a Draft only when it actually changed, and its Lane
// on the Project board (ADR-0019).
import { beforeEach, describe, expect, it } from 'vitest'

import type { ServerEvent } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta, rewriteAc02, v1Draft } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import type { Hub } from '../hub.ts'
import { getDraft } from '../storage/drafts.ts'
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

  describe('Lanes', () => {
    const newPbi = async () => {
      const { id: projectId } = await createProject('P', 'azure-devops', meta.date)
      const draft = await service.create(projectId, {
        workItemType: 'PBI',
        templateId: defaultPbiTemplate.id,
        requirement: 'x',
        references: [],
      })
      return { projectId, draft }
    }

    it('starts a new Draft in Grilling', async () => {
      const { draft } = await newPbi()
      expect(draft.lane).toBe('grilling')
    })

    it('moves a Draft between Lanes and Archives it without counting either as an update', async () => {
      const { projectId, draft } = await newPbi()
      const moved = await service.moveToLane(projectId, draft.id, 'ready')
      expect([moved.lane, moved.updatedAt]).toEqual(['ready', draft.updatedAt])
      const archived = await service.setArchived(projectId, draft.id, true)
      expect([archived.archived, archived.lane, archived.updatedAt]).toEqual([true, 'ready', draft.updatedAt])
      expect((await service.setArchived(projectId, draft.id, false)).archived).toBe(false)
    })

    it('moves a Draft to Needs you when a new Proposal arrives, and only then', async () => {
      const { projectId, draft } = await newPbi()
      const written = v1Draft()
      const change = { ...rewriteAc02(written), id: 'c1', label: 'AC02', after: 'x', conflict: false }
      const withProposal = (id: string) => ({
        id,
        sessionId: 's1',
        kind: 'iteration' as const,
        createdAt: meta.date,
        changes: [{ ...change, status: 'pending' as const }],
      })
      await service.moveToLane(projectId, draft.id, 'review')
      await service.update(projectId, draft.id, (current) => ({ ...current, proposal: withProposal('p1') }))
      expect((await getDraft(projectId, draft.id)).lane).toBe('needs')

      await service.moveToLane(projectId, draft.id, 'review')
      await service.update(projectId, draft.id, (current) => ({ ...current, requirement: 'edited' }))
      expect((await getDraft(projectId, draft.id)).lane).toBe('review')

      await service.update(projectId, draft.id, (current) => ({ ...current, proposal: withProposal('p2') }))
      expect((await getDraft(projectId, draft.id)).lane).toBe('needs')
    })
  })
})
