// Tests for what git reports about a Code Folder, against real temporary repositories.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { git } from '../../test/server/git.ts'
import { makeTestFolder } from '../../test/server/testFolders.ts'
import { gitState, notIgnoredFiles } from './gitFacts.ts'

let root: string
const byName = (a: string, b: string) => a.localeCompare(b)

const write = (relative: string, content = 'x') => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** A repo on branch main with one commit: source, a nested .gitignore and an ignored build folder. */
function makeRepo() {
  git(root, 'init', '-q', '-b', 'main')
  write('.gitignore', 'node_modules/\n.env\n')
  write('src/App.tsx')
  write('packages/ui/.gitignore', 'dist/\n')
  write('packages/ui/src/Button.tsx')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  write('packages/ui/dist/button.js')
  write('node_modules/react/index.js')
  write('.env', 'SECRET=1')
  write('src/New.tsx') // untracked, not ignored
}

beforeEach(() => {
  root = makeTestFolder('gs-git')
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('git facts', () => {
  it('reports branch, short commit and a clean tree', async () => {
    makeRepo()
    fs.rmSync(path.join(root, 'src/New.tsx'))
    const state = await gitState(root)
    expect(state).toMatchObject({ available: true, inGit: true, branch: 'main', uncommitted: 0, hasIgnoreRules: true })
    expect(state.inGit && state.commit).toMatch(/^[0-9a-f]{7,}$/)
  })

  it('counts uncommitted changes, untracked files included and ignored ones not', async () => {
    makeRepo()
    write('src/App.tsx', 'changed')
    const state = await gitState(root)
    expect(state.inGit && state.uncommitted).toBe(2)
  })

  it('reports a detached HEAD as no branch', async () => {
    makeRepo()
    git(root, 'checkout', '-q', '--detach')
    const state = await gitState(root)
    expect(state.inGit && state.branch).toBeNull()
  })

  it('lists exactly the files git does not ignore, honouring nested ignore rules', async () => {
    makeRepo()
    const files = await notIgnoredFiles(root)
    expect([...files!].toSorted(byName)).toEqual([
      '.gitignore',
      'packages/ui/.gitignore',
      'packages/ui/src/Button.tsx',
      'src/App.tsx',
      'src/New.tsx',
    ])
  })

  it('works on a subfolder of a repository, relative to that subfolder', async () => {
    makeRepo()
    const ui = path.join(root, 'packages', 'ui')
    expect([...(await notIgnoredFiles(ui))!].toSorted(byName)).toEqual(['.gitignore', 'src/Button.tsx'])
    expect(await gitState(ui)).toMatchObject({ inGit: true, branch: 'main', uncommitted: 0, hasIgnoreRules: true })
  })

  it('suggests the remote’s default branch when there is one', async () => {
    makeRepo()
    const clone = path.join(root, 'clone')
    git(root, 'clone', '-q', root, clone)
    git(clone, 'checkout', '-q', '-b', 'feature/x')
    const state = await gitState(clone)
    expect(state).toMatchObject({ branch: 'feature/x', suggestedDefaultBranch: 'main' })
  })

  it('reports a folder outside git, with no ignore rules and no file list', async () => {
    write('a.txt')
    expect(await gitState(root)).toEqual({ available: true, inGit: false, hasIgnoreRules: false })
    expect(await notIgnoredFiles(root)).toBeNull()
  })

  it('treats every folder as outside git when git is not installed', async () => {
    makeRepo()
    const missing = { gitBin: path.join(root, 'no-such-git') }
    expect(await gitState(root, missing)).toEqual({ available: false, inGit: false, hasIgnoreRules: false })
    expect(await notIgnoredFiles(root, missing)).toBeNull()
  })
})
