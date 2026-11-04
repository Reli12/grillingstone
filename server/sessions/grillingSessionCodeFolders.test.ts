// Tests for Code Folders when a Grilling Session starts: the human's choice, what the seed, intro, Transcript and
// session scope get, missing folders, and Continuations re-reading the branch state. Data in data-test/.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { writeV1 } from '#core/draft/draft.ts'
import type { ServerEvent } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta, validPbiContent } from '#core/testing/fixtures.ts'

import { git } from '../../test/server/git.ts'
import { resetTestData } from '../../test/server/testBackend.ts'
import { makeTestFolder } from '../../test/server/testFolders.ts'
import { CodeFolderService } from '../codeFolders/codeFolderService.ts'
import type { Hub } from '../hub.ts'
import { DraftService } from '../services/draftService.ts'
import { GlossaryService } from '../services/glossaryService.ts'
import { createProject } from '../storage/projects.ts'
import { prepareGrillingSession, type StartArgs } from './grillingSession.ts'

let deps: { hub: Hub; drafts: DraftService; glossary: GlossaryService; codeFolders: CodeFolderService }
let projectId: string
let base: string
let appRoot: string

beforeEach(async () => {
  await resetTestData()
  const hub = { broadcast: (_event: ServerEvent) => undefined } as Hub
  deps = {
    hub,
    drafts: new DraftService(hub),
    glossary: new GlossaryService(hub),
    codeFolders: new CodeFolderService(),
  }
  projectId = (await createProject('Fleet', 'azure-devops', meta.date)).id
  base = makeTestFolder('gs-sess')
  appRoot = path.join(base, 'app')
  fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true })
  fs.writeFileSync(path.join(appRoot, 'src', 'App.tsx'), 'x')
  git(appRoot, 'init', '-q', '-b', 'main')
  git(appRoot, 'add', '.')
  git(appRoot, 'commit', '-q', '-m', 'init')
})
afterEach(() => fs.rmSync(base, { recursive: true, force: true }))

async function newDraft() {
  return deps.drafts.create(projectId, {
    workItemType: 'PBI',
    templateId: defaultPbiTemplate.id,
    requirement: 'Archive devices',
    references: [],
  })
}

const start = (draftId: string, more: Partial<StartArgs> = {}) =>
  prepareGrillingSession({ projectId, draftId, kind: 'first', ...more }, deps)

const linkApp = () =>
  deps.codeFolders.add(projectId, { path: appRoot, label: 'app', defaultBranch: 'main', extraExclusions: [] })

describe('Code Folders when a Grilling Session starts', () => {
  it('reads nothing when the Project has no Code Folders', async () => {
    const prepared = await start((await newDraft()).id)
    expect(prepared.scope.codeFolders).toBeUndefined()
    expect(prepared.seed.firstMessage).not.toContain('## Code Folders')
    expect(prepared.transcript.codeFolders).toBeUndefined()
  })

  it('reads the Project’s Code Folders by default, recording their branch state', async () => {
    await linkApp()
    const prepared = await start((await newDraft()).id)
    expect(prepared.scope.codeFolders?.map((folder) => folder.label)).toEqual(['app'])
    expect(prepared.seed.firstMessage).toContain('- app — on main (its default branch) at ')
    expect(prepared.transcript.codeFolders).toMatchObject([
      { label: 'app', branch: 'main', onDefaultBranch: true, uncommitted: 0 },
    ])
    expect(prepared.intro).toContain('Claude may read the Code Folder app (main).')
  })

  it('reads none when the human unticks Read Code Folders', async () => {
    await linkApp()
    const prepared = await start((await newDraft()).id, { readCodeFolders: false })
    expect(prepared.scope.codeFolders).toBeUndefined()
    expect(prepared.seed.firstMessage).not.toContain('## Code Folders')
    expect(prepared.intro).not.toContain('Code Folder')
  })

  it('leaves a missing folder out and names it in the intro', async () => {
    await linkApp()
    const gone = path.join(base, 'gone')
    fs.mkdirSync(gone)
    await deps.codeFolders.add(projectId, { path: gone, label: 'reports', defaultBranch: '', extraExclusions: [] })
    fs.rmSync(gone, { recursive: true })
    const prepared = await start((await newDraft()).id)
    expect(prepared.scope.codeFolders?.map((folder) => folder.label)).toEqual(['app'])
    expect(prepared.seed.firstMessage).toContain('Missing, so not readable this session: reports.')
    expect(prepared.intro).toContain('reports is missing, so it is skipped.')
  })

  it('marks code off the default branch or uncommitted in the intro', async () => {
    await linkApp()
    git(appRoot, 'checkout', '-q', '-b', 'spike')
    fs.writeFileSync(path.join(appRoot, 'src', 'App.tsx'), 'changed')
    const prepared = await start((await newDraft()).id)
    expect(prepared.intro).toContain('Claude may read the Code Folder app (spike, not main, 1 uncommitted change).')
    expect(prepared.seed.firstMessage).toContain('NOT its default branch main')
  })

  it('reads the branch state afresh for a Continuation, honouring the choice made for it', async () => {
    await linkApp()
    const draft = await newDraft()
    await deps.drafts.update(projectId, draft.id, (current) => writeV1(current, validPbiContent(), meta))
    git(appRoot, 'checkout', '-q', '-b', 'later')
    const earlier = (await start(draft.id, { kind: 'iteration', readCodeFolders: false })).transcript
    const continued = await start(draft.id, { kind: 'iteration', continues: earlier })
    expect(continued.transcript.codeFolders).toMatchObject([{ label: 'app', branch: 'later' }])
    const without = await start(draft.id, { kind: 'iteration', continues: earlier, readCodeFolders: false })
    expect(without.scope.codeFolders).toBeUndefined()
  })
})
