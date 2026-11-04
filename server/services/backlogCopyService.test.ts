// Tests for Backlog Copies on the server: pasting, refusing duplicates and Jira Projects, re-pasting (which flags
// referencing Drafts), deleting (which removes their references), and Drafts created from them. Data in data-test/.
import fs from 'node:fs/promises'

import { beforeEach, describe, expect, it } from 'vitest'

import type { ServerEvent } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import type { Hub } from '../hub.ts'
import { getDraft, listDrafts, summarize } from '../storage/drafts.ts'
import { Conflict } from '../storage/errors.ts'
import { backlogCopyFile } from '../storage/paths.ts'
import { createProject } from '../storage/projects.ts'
import { BacklogCopyService } from './backlogCopyService.ts'
import { DraftInputError, DraftService } from './draftService.ts'

let events: ServerEvent[]
let drafts: DraftService
let copies: BacklogCopyService
let projectId: string

const feature = {
  workItem: '#1234',
  workItemType: 'Feature',
  title: 'Device archiving',
  content: 'BR1 — A Manager can archive a device.',
  acceptanceCriteria: 'AC1 — Archived devices leave dashboards.',
}

const pbiFrom = (backlogReferences: string[], requirement = '') => ({
  workItemType: 'PBI' as const,
  templateId: defaultPbiTemplate.id,
  requirement,
  references: [],
  backlogReferences,
  newBacklogCopies: [],
})

beforeEach(async () => {
  await resetTestData()
  events = []
  const hub = { broadcast: (event: ServerEvent) => void events.push(event) } as Hub
  drafts = new DraftService(hub)
  copies = new BacklogCopyService(hub, drafts)
  projectId = (await createProject('Fleet', 'azure-devops', meta.date)).id
})

describe('BacklogCopyService', () => {
  it('pastes a Copy, lists it without Drafts and writes the markdown a session reads', async () => {
    const copy = await copies.create(projectId, feature)
    expect(copy).toMatchObject({ id: 'ado-1234', revision: 1, acceptanceCriteria: feature.acceptanceCriteria })
    expect(await copies.list(projectId)).toEqual([{ copy, drafts: [] }])
    expect(await fs.readFile(backlogCopyFile(projectId, 'ado-1234', 'md'), 'utf8')).toContain(
      '# Feature #1234: Device archiving',
    )
    expect(events).toContainEqual({ type: 'backlogCopies', projectId })
  })

  it('refuses a work item already copied, invalid input and a Jira Project', async () => {
    await copies.create(projectId, feature)
    await expect(copies.create(projectId, { ...feature, workItem: '1234' })).rejects.toThrow(Conflict)
    await expect(copies.create(projectId, { ...feature, content: ' ' })).rejects.toThrow(DraftInputError)
    const jira = await createProject('Jira', 'jira', meta.date)
    await expect(copies.create(jira.id, feature)).rejects.toThrow('Azure DevOps')
    await expect(copies.list(jira.id)).rejects.toThrow('Azure DevOps')
  })

  it('flags every Draft referencing a re-pasted Copy, and an identical re-paste flags nothing', async () => {
    await copies.create(projectId, feature)
    const first = await drafts.create(projectId, pbiFrom(['ado-1234']))
    const second = await drafts.create(projectId, pbiFrom(['ado-1234']))

    await copies.repaste(projectId, 'ado-1234', {
      content: feature.content,
      acceptanceCriteria: feature.acceptanceCriteria,
    })
    expect((await copies.list(projectId))[0].copy.revision).toBe(1)

    await copies.repaste(projectId, 'ado-1234', {
      content: 'BR1 — changed.',
      acceptanceCriteria: feature.acceptanceCriteria,
    })
    const [listed] = await copies.list(projectId)
    expect(listed.copy.revision).toBe(2)
    expect(listed.drafts.map((draft) => [draft.id, draft.changed]).sort()).toEqual(
      [
        [first.id, true],
        [second.id, true],
      ].sort(),
    )
    const summaries = (await listDrafts(projectId)).map((draft) => summarize(draft, [listed.copy]))
    expect(summaries.map((summary) => summary.changedBacklogCopies)).toEqual([[1234], [1234]])
  })

  it('deletes a Copy and removes the references to it from every Draft', async () => {
    await copies.create(projectId, feature)
    await copies.create(projectId, { ...feature, workItem: '1422', workItemType: 'Bug', title: 'Search bug' })
    const draft = await drafts.create(projectId, pbiFrom(['ado-1234', 'ado-1422']))
    await copies.delete(projectId, 'ado-1234')
    expect(await copies.list(projectId)).toHaveLength(1)
    expect((await getDraft(projectId, draft.id)).backlogReferences).toEqual([{ copyId: 'ado-1422', seenRevision: 1 }])
  })
})

describe('Drafts and Backlog References', () => {
  it('makes the requirement optional once a Backlog Reference is attached, and only then', async () => {
    await copies.create(projectId, feature)
    const draft = await drafts.create(projectId, pbiFrom(['ado-1234']))
    expect([draft.requirement, draft.backlogReferences]).toEqual(['', [{ copyId: 'ado-1234', seenRevision: 1 }]])
    await expect(drafts.create(projectId, pbiFrom(['ado-ghost']))).rejects.toThrow(DraftInputError)
  })

  it('pastes a new Copy in the same request that creates the Draft', async () => {
    const draft = await drafts.create(projectId, { ...pbiFrom([]), newBacklogCopies: [feature] })
    expect(draft.backlogReferences).toEqual([{ copyId: 'ado-1234', seenRevision: 1 }])
    expect((await copies.list(projectId)).map((listed) => listed.drafts.map((referencing) => referencing.id))).toEqual([
      [draft.id],
    ])
  })

  it('creates nothing when a pasted Copy is refused', async () => {
    await expect(
      drafts.create(projectId, { ...pbiFrom([], 'x'), newBacklogCopies: [{ ...feature, title: '' }] }),
    ).rejects.toThrow(DraftInputError)
    expect(await listDrafts(projectId)).toEqual([])
  })

  it('sets the Backlog References of an existing Draft, dropping unknown Copies', async () => {
    const draft = await drafts.create(projectId, pbiFrom([], 'Archive'))
    expect(draft.backlogReferences).toEqual([])
    await copies.create(projectId, feature)
    await copies.repaste(projectId, 'ado-1234', { content: 'BR1 — changed.' })
    const updated = await drafts.setBacklogReferences(projectId, draft.id, ['ado-1234', 'ado-ghost'])
    expect(updated.backlogReferences).toEqual([{ copyId: 'ado-1234', seenRevision: 2 }])
  })

  it('refuses Backlog References in a Jira Project', async () => {
    const jira = await createProject('Jira', 'jira', meta.date)
    await expect(
      drafts.create(jira.id, {
        ...pbiFrom([], 'x'),
        workItemType: 'Story',
        templateId: 'default-jira-story',
        newBacklogCopies: [feature],
      }),
    ).rejects.toThrow('Azure DevOps')
  })
})
