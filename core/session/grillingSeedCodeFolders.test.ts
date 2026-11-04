// Tests for the Code Folders block of a Grilling Session's seed: which folders it may read, on which branch and
// commit, how far to trust them, and the rules for using code. Present only when the session reads Code Folders.
import { describe, expect, it } from 'vitest'

import type { CodeFolderSnapshot } from '#core/codeFolder/codeFolderTypes.ts'
import { buildSeed, type SeedInput } from '#core/session/grillingSeed.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

const app: CodeFolderSnapshot = {
  label: 'app',
  branch: 'main',
  commit: 'a41c9e2',
  uncommitted: 0,
  onDefaultBranch: true,
  defaultBranch: 'main',
  inGit: true,
}
const ui: CodeFolderSnapshot = {
  label: 'ui-lib',
  branch: 'feature/badge-variants',
  commit: '7be0d13',
  uncommitted: 3,
  onDefaultBranch: false,
  defaultBranch: 'develop',
  inGit: true,
}
const plain: CodeFolderSnapshot = { ...app, label: 'docs', inGit: false, branch: null, commit: '' }

const input = (codeFolders?: SeedInput['codeFolders']): SeedInput => ({
  kind: 'iteration',
  draft: v1Draft(),
  projectName: 'Fleet',
  glossary: '',
  references: [],
  submitCommand: 'node "/tool/scripts/writeDraft.mjs"',
  payloadFile: '.submit/sess-1.json',
  ...(codeFolders ? { codeFolders } : {}),
})

const seedText = (codeFolders?: SeedInput['codeFolders']) => {
  const seed = buildSeed(input(codeFolders))
  return seed.systemPrompt + seed.firstMessage
}

describe('Grilling seed — Code Folders', () => {
  it('has no Code Folders block when the session reads none', () => {
    expect(seedText()).not.toContain('## Code Folders')
    expect(seedText({ folders: [], missing: [] })).not.toContain('## Code Folders')
    expect(seedText()).not.toContain('read_code_file')
  })

  it('lists each Code Folder with its branch, commit and uncommitted state', () => {
    const text = seedText({ folders: [app, ui, plain], missing: [] })
    expect(text).toContain('## Code Folders')
    expect(text).toContain('- app — on main (its default branch) at a41c9e2, no uncommitted changes')
    expect(text).toContain(
      '- ui-lib — on feature/badge-variants, NOT its default branch develop, at 7be0d13, 3 uncommitted changes — possibly not yet true',
    )
    expect(text).toContain('- docs — not in git, so no branch information')
  })

  it('names the code tools and gives the rules for using code', () => {
    const text = seedText({ folders: [app], missing: [] })
    for (const tool of ['list_code_files', 'search_code', 'read_code_file']) expect(text).toContain(tool)
    expect(text).toContain('how the app works today, never what should happen')
    expect(text).toContain('`label: path`')
    expect(text).toContain('Open Question')
    expect(text).toContain('possibly not yet true')
    expect(text).toContain('Excluded Files')
  })

  it('names folders that are missing and skipped', () => {
    expect(seedText({ folders: [app], missing: ['reports'] })).toContain(
      'Missing, so not readable this session: reports.',
    )
  })

  it('treats a detached HEAD as off the default branch', () => {
    const detached = { ...app, branch: null, onDefaultBranch: false }
    expect(seedText({ folders: [detached], missing: [] })).toContain(
      '- app — at detached commit a41c9e2, NOT its default branch main, no uncommitted changes — possibly not yet true',
    )
  })
})
