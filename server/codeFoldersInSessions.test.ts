// End to end through the real backend with the fake Claude (ADR-0016): a Project links a git repo holding a .env and
// a .env.example; a Grilling Session started with Code Folders gets the code tools MCP server, lists and reads the
// source and .env.example through it, is refused .env, and the secret never reaches its Transcript. A session
// started without Code Folders gets no code tools at all. Data in data-test/.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { Transcript } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { git } from '../test/server/git.ts'
import { startBackend } from '../test/server/testBackend.ts'
import { makeTestFolder } from '../test/server/testFolders.ts'

const SECRET = 'TOKEN=hunter2-super-secret'

let backend: Awaited<ReturnType<typeof startBackend>>
let base: string

beforeEach(async () => {
  backend = await startBackend()
  base = makeTestFolder('gs-e2e')
})
afterEach(async () => {
  await backend.close()
  fs.rmSync(base, { recursive: true, force: true })
})

/** A git repo with source, a committed .env.example and an ignored .env holding a secret. */
function repo() {
  const root = path.join(base, 'fleet-portal')
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, '.gitignore'), '.env\n')
  fs.writeFileSync(path.join(root, 'src', 'App.tsx'), 'export const App = () => null\n')
  fs.writeFileSync(path.join(root, '.env.example'), 'TOKEN=\n')
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  fs.writeFileSync(path.join(root, '.env'), `${SECRET}\n`)
  return root
}

const transcripts = async (projectId: string, draftId: string) =>
  (await backend.call('GET', `/api/projects/${projectId}/drafts/${draftId}/sessions`)).body as Transcript[]

/** A Project with the repo linked, and a Draft whose first session waits for the human. */
async function grilling(readCodeFolders?: boolean) {
  const project = (await backend.call('POST', '/api/projects', { name: 'Fleet' })).body as { id: string }
  await backend.call('POST', `/api/projects/${project.id}/code-folders`, {
    path: repo(),
    label: 'app',
    defaultBranch: 'main',
  })
  const created = await backend.call('POST', `/api/projects/${project.id}/drafts`, {
    workItemType: 'PBI',
    templateId: defaultPbiTemplate.id,
    requirement: 'Managers archive devices.',
    ...(readCodeFolders === undefined ? {} : { readCodeFolders }),
  })
  const { draft, session } = created.body as { draft: Draft; session: { id: string } }
  await vi.waitFor(async () => expect((await transcripts(project.id, draft.id)).at(-1)?.status).toBe('waiting'), {
    timeout: 8000,
    interval: 50,
  })
  return { projectId: project.id, draftId: draft.id, sessionId: session.id }
}

/** Says READ CODE and returns the fake Claude's report, one line per code tool call. */
async function readCode({ projectId, draftId, sessionId }: Awaited<ReturnType<typeof grilling>>) {
  await backend.call('POST', `/api/sessions/${sessionId}/messages`, { text: 'READ CODE' })
  let report = ''
  await vi.waitFor(
    async () => {
      const [latest] = (await transcripts(projectId, draftId)).slice(-1)
      const said = latest.messages.flatMap((message) =>
        message.role === 'claude'
          ? message.segments.filter((segment) => segment.type === 'text').map((segment) => segment.text)
          : [],
      )
      report = said.find((text) => text.startsWith('LIST') || text === 'NO CODE TOOLS') ?? ''
      expect(report).not.toBe('')
    },
    { timeout: 10000, interval: 100 },
  )
  return report
}

describe('Code Folders in a running Grilling Session', () => {
  it('lists and reads the source and .env.example through the code tools, but never .env', async () => {
    const grilled = await grilling()
    const report = await readCode(grilled)
    const line = (prefix: string) => report.split('\n').find((candidate) => candidate.startsWith(prefix)) ?? ''
    expect(line('LIST')).toContain('OK app: .env.example | app: .gitignore | app: src/App.tsx')
    expect(line('LIST')).not.toContain('app: .env |')
    expect(line('EXAMPLE')).toContain('OK app: .env.example (1 line) | 1\tTOKEN=')
    expect(line('ENV')).toMatch(/^ENV REFUSED .*Excluded File/)
    expect(line('SEARCH')).toBe('SEARCH OK app: .env.example:1: TOKEN=')
    const saved = JSON.stringify(await transcripts(grilled.projectId, grilled.draftId))
    expect(saved).not.toContain('hunter2')
    const [latest] = (await transcripts(grilled.projectId, grilled.draftId)).slice(-1)
    expect(latest.codeFolders).toMatchObject([{ label: 'app', branch: 'main', onDefaultBranch: true }])
  })

  it('gives a session started without Code Folders no code tools at all', async () => {
    const grilled = await grilling(false)
    expect(await readCode(grilled)).toBe('NO CODE TOOLS')
  })
})
