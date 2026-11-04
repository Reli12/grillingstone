// Tests for the Code Folder API: checking a folder, linking, editing and unlinking it, its current branch state and
// the exclusion preview — through HTTP, over real temporary folders. Data in data-test/.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { git } from '../../test/server/git.ts'
import { startBackend } from '../../test/server/testBackend.ts'
import { makeTestFolder } from '../../test/server/testFolders.ts'
import { DATA_DIR, TOOL_DIR } from '../config.ts'
import { writeJson } from '../storage/fsUtil.ts'
import { projectFile } from '../storage/paths.ts'

let backend: Awaited<ReturnType<typeof startBackend>>
let base: string
let projectId: string

function write(root: string, relative: string, content = 'x') {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** A git repo on main: source, an ignored dependency, a .env and its example. */
function repo(name = 'fleet-portal') {
  const root = path.join(base, name)
  fs.mkdirSync(root)
  git(root, 'init', '-q', '-b', 'main')
  write(root, '.gitignore', 'node_modules/\n.env\n')
  write(root, 'src/App.tsx')
  write(root, '.env.example', 'TOKEN=')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  write(root, '.env', 'TOKEN=secret')
  write(root, 'node_modules/react/index.js')
  write(root, 'exports/customers.csv')
  return root
}

const link = (folder: Record<string, unknown>, id = projectId) =>
  backend.call('POST', `/api/projects/${id}/code-folders`, folder)

beforeEach(async () => {
  backend = await startBackend()
  base = makeTestFolder('gs-cf')
  projectId = (await backend.call('POST', '/api/projects', { name: 'Fleet', tracker: 'jira' })).body.id
})
afterEach(async () => {
  await backend.close()
  fs.rmSync(base, { recursive: true, force: true })
})

describe('checking a folder before linking', () => {
  it('accepts a git checkout and suggests a label and the default branch', async () => {
    const root = repo()
    const { status, body } = await backend.call('POST', `/api/projects/${projectId}/code-folders/check`, { path: root })
    expect(status).toBe(200)
    expect(body).toMatchObject({
      check: { status: 'ok' },
      suggestedLabel: 'fleet-portal',
      suggestedDefaultBranch: 'main',
      inGit: true,
    })
  })

  it('refuses the tool’s own folder, which contains its data', async () => {
    const { body } = await backend.call('POST', `/api/projects/${projectId}/code-folders/check`, { path: TOOL_DIR })
    expect(body.check.status).toBe('rejected')
    expect(body.check.reasons.map((reason: { code: string }) => reason.code)).toContain('tool-data')
  })

  it('refuses a missing folder and a drive root', async () => {
    const missing = await backend.call('POST', `/api/projects/${projectId}/code-folders/check`, {
      path: path.join(base, 'nope'),
    })
    expect(missing.body.check.reasons[0].code).toBe('missing')
    const root = await backend.call('POST', `/api/projects/${projectId}/code-folders/check`, {
      path: path.parse(base).root,
    })
    expect(root.body.check.reasons.map((reason: { code: string }) => reason.code)).toContain('drive-root')
  })

  it('warns about a folder outside git', async () => {
    const plain = path.join(base, 'plain')
    write(plain, 'a.ts')
    const { body } = await backend.call('POST', `/api/projects/${projectId}/code-folders/check`, { path: plain })
    expect(body.check.status).toBe('ok-with-warnings')
    expect(body.check.warnings.map((reason: { code: string }) => reason.code)).toEqual([
      'not-in-git',
      'no-ignore-rules',
    ])
    expect(body.inGit).toBe(false)
  })
})

describe('linking, editing and unlinking', () => {
  it('links a folder to the Project, keeping the path as given', async () => {
    const root = repo()
    const { status } = await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: [] })
    expect(status).toBe(200)
    const project = (await backend.call('GET', `/api/projects/${projectId}`)).body
    expect(project.codeFolders).toMatchObject([
      { label: 'app', path: root, defaultBranch: 'main', extraExclusions: [] },
    ])
  })

  it('links a folder despite warnings, and the same folder to a second Project', async () => {
    const plain = path.join(base, 'plain')
    write(plain, 'a.ts')
    expect((await link({ path: plain, label: 'plain', defaultBranch: '', extraExclusions: [] })).status).toBe(200)
    const other = (await backend.call('POST', '/api/projects', { name: 'Other' })).body.id
    expect((await link({ path: plain, label: 'plain', defaultBranch: '', extraExclusions: [] }, other)).status).toBe(
      200,
    )
  })

  it('refuses a rejected folder, a bad label and a label already used, with reasons', async () => {
    const dataLink = await link({ path: DATA_DIR, label: 'data', defaultBranch: '', extraExclusions: [] })
    expect(dataLink.status).toBe(422)
    expect(dataLink.body.reasons.map((reason: { code: string }) => reason.code)).toContain('tool-data')
    const root = repo()
    expect(
      (await link({ path: root, label: 'Bad Label', defaultBranch: 'main', extraExclusions: [] })).body.reasons[0].code,
    ).toBe('label-format')
    await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: [] })
    expect(
      (await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: [] })).body.reasons[0].code,
    ).toBe('label-taken')
  })

  it('edits the label, default branch and extra exclusions, keeping labels unique', async () => {
    const root = repo()
    await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: [] })
    const second = await link({ path: root, label: 'ui', defaultBranch: 'main', extraExclusions: [] })
    const id = second.body.codeFolders.find((folder: { label: string }) => folder.label === 'ui').id
    const edited = await backend.call('PATCH', `/api/projects/${projectId}/code-folders/${id}`, {
      label: 'ui-lib',
      defaultBranch: 'develop',
      extraExclusions: ['exports/**', '  '],
    })
    expect(edited.status).toBe(200)
    expect(edited.body.codeFolders[1]).toMatchObject({
      label: 'ui-lib',
      defaultBranch: 'develop',
      extraExclusions: ['exports/**'],
    })
    const clash = await backend.call('PATCH', `/api/projects/${projectId}/code-folders/${id}`, { label: 'app' })
    expect(clash.body.reasons[0].code).toBe('label-taken')
  })

  it('unlinks a folder without touching it', async () => {
    const root = repo()
    const id = (await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: [] })).body
      .codeFolders[0].id
    expect((await backend.call('DELETE', `/api/projects/${projectId}/code-folders/${id}`)).status).toBe(200)
    expect((await backend.call('GET', `/api/projects/${projectId}`)).body.codeFolders).toEqual([])
    expect(fs.existsSync(path.join(root, 'src/App.tsx'))).toBe(true)
  })

  it('reads a Project saved before Code Folders as having none', async () => {
    await writeJson(projectFile(projectId), { id: projectId, name: 'Fleet', createdAt: '2026-01-01', tracker: 'jira' })
    expect((await backend.call('GET', `/api/projects/${projectId}`)).body.codeFolders).toEqual([])
    expect((await backend.call('GET', `/api/projects/${projectId}/code-folders/state`)).body).toEqual([])
  })
})

describe('current state and exclusions', () => {
  it('reports branch, commit and uncommitted changes, and a missing folder', async () => {
    const root = repo()
    await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: [] })
    git(root, 'checkout', '-q', '-b', 'feature/badge')
    write(root, 'src/App.tsx', 'changed')
    const gone = path.join(base, 'gone')
    write(gone, 'a.ts')
    await link({ path: gone, label: 'gone', defaultBranch: '', extraExclusions: [] })
    fs.rmSync(gone, { recursive: true })
    const { body } = await backend.call('GET', `/api/projects/${projectId}/code-folders/state`)
    expect(body[0]).toMatchObject({
      label: 'app',
      missing: false,
      inGit: true,
      branch: 'feature/badge',
      onDefaultBranch: false,
    })
    expect(body[0].uncommitted).toBe(2) // App.tsx changed, exports/customers.csv untracked
    expect(body[0].commit).toMatch(/^[0-9a-f]{7,}$/)
    expect(body[1]).toMatchObject({ label: 'gone', missing: true })
  })

  it('previews what is excluded, by rule, and what stays readable', async () => {
    const root = repo()
    const id = (await link({ path: root, label: 'app', defaultBranch: 'main', extraExclusions: ['exports/**'] })).body
      .codeFolders[0].id
    const { body } = await backend.call('GET', `/api/projects/${projectId}/code-folders/${id}/exclusions`)
    const group = (rule: string) => body.groups.find((candidate: { rule: string }) => candidate.rule === rule)
    expect(group('environment')).toMatchObject({ fixed: true, count: 1, examples: ['.env'] })
    expect(group('ignored')).toMatchObject({ fixed: false, examples: ['node_modules/'] })
    expect(group('extra')).toMatchObject({ fixed: false, count: 1, examples: ['exports/customers.csv'] })
    expect(body.readable).toBe(3) // .gitignore, .env.example, src/App.tsx
    expect(body.stillReadable).toEqual(['.env.example'])
  })
})

describe('the internal code tools endpoint', () => {
  it('answers only a running session that presents its token', async () => {
    const reply = await backend.call(
      'POST',
      '/api/internal/sessions/sess-nope/code/read_code_file',
      { folder: 'app', path: 'x' },
      {
        'x-pbi-session-token': 'guess',
      },
    )
    expect(reply.body).toEqual({ isError: true, text: 'This session is not running.' })
  })
})
