// Tests for the Excluded File policy (ADR-0017): which paths in a Code Folder no session may read, search or list.
import { describe, expect, it } from 'vitest'

import { exclusionOf, folderExcluded, type FolderExclusions } from '#core/codeFolder/excludedFiles.ts'

/** A folder outside git with no extra patterns: only the fixed exclusions apply. */
const bare: FolderExclusions = { notIgnored: null, extraPatterns: [] }

describe('Excluded File policy — fixed exclusions', () => {
  const excluded: [string, string][] = [
    ['.env', 'environment'],
    ['.ENV', 'environment'],
    ['apps/web/.env', 'environment'],
    ['.env.local', 'environment'],
    ['deep/er/.env.Production', 'environment'],
    ['certs/dev.pem', 'key'],
    ['docker/nginx/server.KEY', 'key'],
    ['certs/client.pfx', 'key'],
    ['certs/client.p12', 'key'],
    ['certs/bundle.crt', 'key'],
    ['home/.ssh/id_rsa', 'key'],
    ['id_rsa.pub', 'key'],
    ['keys/id_ed25519', 'key'],
    ['.npmrc', 'credentials'],
    ['packages/ui/.npmrc', 'credentials'],
    ['.yarnrc.yml', 'credentials'],
    ['.pypirc', 'credentials'],
    ['.netrc', 'credentials'],
    ['.git-credentials', 'credentials'],
    ['api/appsettings.Development.json', 'settings'],
    ['APPSETTINGS.PRODUCTION.JSON', 'settings'],
    ['secrets.json', 'named-secret'],
    ['api/local.settings.json', 'settings'],
    ['scripts/load-secrets.ps1', 'named-secret'],
    ['config/Secret/app.json', 'named-secret'],
    ['aws-credentials.txt', 'named-secret'],
    ['src/CredentialStore/index.ts', 'named-secret'],
    ['.git/config', 'vcs'],
    ['packages/ui/.git/HEAD', 'vcs'],
    ['.GIT/config', 'vcs'],
  ]
  it.each(excluded)('excludes %s (%s)', (filePath, rule) => {
    expect(exclusionOf(filePath, bare)).toBe(rule)
  })

  const readable = [
    '.env.example',
    'apps/web/.env.sample',
    '.ENV.EXAMPLE',
    'api/appsettings.json',
    'src/devices/DeviceList.tsx',
    'README.md',
    '.gitignore',
    '.github/workflows/ci.yml',
    'src/environment.ts',
    'docs/keyboard.md',
  ]
  it.each(readable)('lets %s be read', (filePath) => {
    expect(exclusionOf(filePath, bare)).toBeNull()
  })

  it('accepts Windows separators', () => {
    expect(exclusionOf('apps\\web\\.env', bare)).toBe('environment')
    expect(exclusionOf('src\\devices\\DeviceList.tsx', bare)).toBeNull()
  })
})

describe('Excluded File policy — ignore rules and extra patterns', () => {
  const inGit: FolderExclusions = {
    notIgnored: new Set(['src/App.tsx', 'README.md', '.env.example', 'exports/customers.csv', 'Src/Mixed.ts']),
    extraPatterns: [],
  }

  it('excludes whatever git does not report as not ignored', () => {
    expect(exclusionOf('src/App.tsx', inGit)).toBeNull()
    expect(exclusionOf('node_modules/react/index.js', inGit)).toBe('ignored')
    expect(exclusionOf('dist/app.js', inGit)).toBe('ignored')
  })

  it('compares with git’s own letter case, since git reports paths as they are on disk', () => {
    expect(exclusionOf('Src/Mixed.ts', inGit)).toBeNull()
    expect(exclusionOf('src\\App.tsx', inGit)).toBeNull()
  })

  it('names the fixed rule even when git also ignores the file', () => {
    expect(exclusionOf('.env', inGit)).toBe('environment')
  })

  it('applies the human’s patterns: names at any depth, paths from the root, case-insensitively', () => {
    const folder = (extraPatterns: string[]): FolderExclusions => ({ notIgnored: null, extraPatterns })
    expect(exclusionOf('exports/customers.csv', folder(['exports/**']))).toBe('extra')
    expect(exclusionOf('exports/customers.csv', folder(['exports']))).toBe('extra')
    expect(exclusionOf('a/b/Exports/x.csv', folder(['exports']))).toBe('extra')
    expect(exclusionOf('a/exports/x.csv', folder(['exports/**']))).toBeNull()
    expect(exclusionOf('fixtures/acme.CSV', folder(['*.csv']))).toBe('extra')
    expect(exclusionOf('src/App.tsx', folder(['*.csv', '', '  ']))).toBeNull()
  })

  it('never lets a pattern re-include a fixed exclusion', () => {
    const lifting: FolderExclusions = {
      notIgnored: new Set(['.env', 'certs/dev.pem', '.git/config']),
      extraPatterns: ['!.env', '!**/*.pem', '!.git/**'],
    }
    expect(exclusionOf('.env', lifting)).toBe('environment')
    expect(exclusionOf('certs/dev.pem', lifting)).toBe('key')
    expect(exclusionOf('.git/config', lifting)).toBe('vcs')
  })

  it('never lets a pattern re-include what git ignores', () => {
    const folder: FolderExclusions = { notIgnored: new Set(['src/a.ts']), extraPatterns: ['!dist/**'] }
    expect(exclusionOf('dist/app.js', folder)).toBe('ignored')
  })
})

describe('Excluded File policy — whole folders', () => {
  const folder: FolderExclusions = { notIgnored: null, extraPatterns: ['exports', 'fixtures/customers/**'] }

  it.each([
    ['.git'],
    ['packages/ui/.git'],
    ['config/secrets'],
    ['Credentials'],
    ['exports'],
    ['a/exports'],
    ['fixtures/customers'],
  ])('skips the folder %s entirely', (dir) => expect(folderExcluded(dir, folder)).toBe(true))

  it.each([['src'], ['.github'], ['fixtures'], ['src/environment']])('walks into %s', (dir) => {
    expect(folderExcluded(dir, folder)).toBe(false)
  })
})
