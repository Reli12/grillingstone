// Tests for Backlog References when a Grilling Session starts: what the seed and intro get, and that a launched
// session marks the delivered Copies seen, which clears the changed flag. Data in data-test/.
import { beforeEach, describe, expect, it } from 'vitest'

import { writeV1 } from '#core/draft/draft.ts'
import type { ServerEvent } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta, validPbiContent } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import type { Hub } from '../hub.ts'
import { BacklogCopyService } from '../services/backlogCopyService.ts'
import { DraftService } from '../services/draftService.ts'
import { GlossaryService } from '../services/glossaryService.ts'
import { getDraft } from '../storage/drafts.ts'
import { createProject } from '../storage/projects.ts'
import { prepareGrillingSession } from './grillingSession.ts'

let deps: { hub: Hub; drafts: DraftService; glossary: GlossaryService }
let copies: BacklogCopyService
let projectId: string

const feature = { workItem: '1234', workItemType: 'Feature', title: 'Device archiving', content: 'BR1 — archive.' }

beforeEach(async () => {
  await resetTestData()
  const hub = { broadcast: (_event: ServerEvent) => undefined } as Hub
  deps = { hub, drafts: new DraftService(hub), glossary: new GlossaryService(hub) }
  copies = new BacklogCopyService(hub, deps.drafts)
  projectId = (await createProject('Fleet', 'azure-devops', meta.date)).id
  await copies.create(projectId, feature)
})

async function writtenDraft() {
  const draft = await deps.drafts.create(projectId, {
    workItemType: 'PBI',
    templateId: defaultPbiTemplate.id,
    requirement: '',
    references: [],
    backlogReferences: ['ado-1234'],
  })
  return deps.drafts.update(projectId, draft.id, (current) => writeV1(current, validPbiContent(), meta))
}

const start = (draftId: string, kind: 'first' | 'iteration', includeBacklogInFull = false) =>
  prepareGrillingSession({ projectId, draftId, kind, includeBacklogInFull }, deps)

describe('Backlog References when a session starts', () => {
  it('gives the first session the Copy in full and says so in the intro', async () => {
    const draft = await deps.drafts.create(projectId, {
      workItemType: 'PBI',
      templateId: defaultPbiTemplate.id,
      requirement: '',
      references: [],
      backlogReferences: ['ado-1234'],
    })
    const prepared = await start(draft.id, 'first')
    expect(prepared.seed.firstMessage).toContain('BR1 — archive.')
    expect(prepared.intro).toContain('1 Backlog Reference in full')
  })

  it('only lists the Copy for a later session, unless asked for it in full', async () => {
    const draft = await writtenDraft()
    const listed = await start(draft.id, 'iteration')
    expect(listed.seed.firstMessage).toContain('read backlog-copies/ado-1234.md')
    expect(listed.seed.firstMessage).not.toContain('BR1 — archive.')
    expect(listed.intro).toContain('1 Backlog Reference listed')
    const full = await start(draft.id, 'iteration', true)
    expect(full.seed.firstMessage).toContain('BR1 — archive.')
  })

  it('delivers a re-pasted Copy with what changed, and clears the flag once the session is launched', async () => {
    const draft = await writtenDraft()
    await copies.repaste(projectId, 'ado-1234', { content: 'BR1 — archive, with a reason.' })
    const prepared = await start(draft.id, 'iteration')
    expect(prepared.seed.firstMessage).toContain("Changed since this Draft's last session:")
    expect(prepared.intro).toContain('1 Backlog Reference changed, in full')
    expect((await getDraft(projectId, draft.id)).backlogReferences).toEqual([{ copyId: 'ado-1234', seenRevision: 1 }])

    await prepared.onLaunched?.()
    expect((await getDraft(projectId, draft.id)).backlogReferences).toEqual([{ copyId: 'ado-1234', seenRevision: 2 }])
    const next = await start(draft.id, 'iteration')
    expect(next.seed.firstMessage).toContain('read backlog-copies/ado-1234.md')
  })

  it('leaves out a Copy deleted meanwhile', async () => {
    const draft = await writtenDraft()
    await deps.drafts.update(projectId, draft.id, (current) => ({
      ...current,
      backlogReferences: [...(current.backlogReferences ?? []), { copyId: 'ado-9', seenRevision: 1 }],
    }))
    const prepared = await start(draft.id, 'iteration', true)
    expect(prepared.intro).toContain('1 Backlog Reference in full')
  })
})
