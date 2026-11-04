// Tests for the Code Folder reader (ADR-0016): list, search and read over real temporary folders, with Excluded
// Files never produced — not by listing, not by searching, not by reading, not through a symlink.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { git } from '../../test/server/git.ts'
import { makeTestFolder } from '../../test/server/testFolders.ts'
import { listCodeFiles, openCodeFolder, READ_LIMITS, readCodeFile, searchCode } from './codeFolderReader.ts'

const SECRET = 'hunter2-super-secret-value'
const byName = (a: string, b: string) => a.localeCompare(b)

let base: string
let root: string

const write = (relative: string, content: string | Buffer = 'x') => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** Source, examples and secrets side by side, plus something outside the folder. */
function makeFolder() {
  write(
    'src/devices/DeviceList.tsx',
    'export function DeviceList() {\n  // password field is not here\n  return null\n}\n',
  )
  write('src/devices/archive.ts', 'export const canArchive = true\n')
  write('.env', `DB_PASSWORD=${SECRET}\n`)
  write('apps/web/.env.local', `TOKEN=${SECRET}\n`)
  write('.env.example', 'DB_PASSWORD=\n')
  write('certs/dev.pem', SECRET)
  write('config/secrets/app.json', `{"password":"${SECRET}"}`)
  write('api/appsettings.json', '{"Logging":{}}')
  write('api/appsettings.Development.json', `{"password":"${SECRET}"}`)
  write('exports/customers.csv', `acme,${SECRET}`)
  write('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x01]))
  fs.writeFileSync(path.join(base, 'outside.txt'), SECRET)
}

const open = (extraExclusions: string[] = ['exports/**']) =>
  openCodeFolder({ label: 'app', path: root, extraExclusions })

beforeEach(() => {
  base = makeTestFolder('gs-reader')
  root = path.join(base, 'app')
  fs.mkdirSync(root)
  makeFolder()
})
afterEach(() => fs.rmSync(base, { recursive: true, force: true }))

describe('Code Folder reader — outside git', () => {
  it('lists readable files and never an Excluded File', async () => {
    const listed = await listCodeFiles(await open(), {})
    expect(listed.files.toSorted(byName)).toEqual([
      '.env.example',
      'api/appsettings.json',
      'src/devices/archive.ts',
      'src/devices/DeviceList.tsx',
    ])
    expect(listed.truncated).toBe(false)
  })

  it('lists within a subfolder or by glob', async () => {
    const folder = await open()
    expect((await listCodeFiles(folder, { subfolder: 'src/devices' })).files.toSorted(byName)).toEqual([
      'src/devices/archive.ts',
      'src/devices/DeviceList.tsx',
    ])
    expect((await listCodeFiles(folder, { glob: '*.tsx' })).files).toEqual(['src/devices/DeviceList.tsx'])
  })

  it('never returns a secret’s value from a search, whatever the pattern', async () => {
    const folder = await open()
    for (const pattern of [SECRET, 'password', 'hunter2', '.*'])
      for (const match of (await searchCode(folder, { pattern, limit: 500 })).matches) {
        expect(match.text).not.toContain(SECRET)
        expect(match.path).not.toMatch(/\.env$|\.env\.local|\.pem|secrets|Development|exports/)
      }
    const found = await searchCode(folder, { pattern: 'password' })
    expect(found.matches.map((match) => `${match.path}:${match.line}`).sort()).toEqual([
      '.env.example:1',
      'src/devices/DeviceList.tsx:2',
    ])
  })

  it('reads a source file with line numbers, and a line range', async () => {
    const folder = await open()
    const whole = await readCodeFile(folder, { path: 'src/devices/DeviceList.tsx' })
    expect(whole).toMatchObject({ ok: true, totalLines: 4 })
    expect(whole.ok && whole.content).toContain('2\t  // password field is not here')
    const part = await readCodeFile(folder, { path: 'src\\devices\\DeviceList.tsx', startLine: 3, endLine: 3 })
    expect(part.ok && part.content).toBe('3\t  return null')
  })

  it.each([
    ['.env'],
    ['apps/web/.env.local'],
    ['certs/dev.pem'],
    ['config/secrets/app.json'],
    ['exports/customers.csv'],
    ['.ENV'],
  ])('refuses to read the Excluded File %s, without its content', async (excluded) => {
    const result = await readCodeFile(await open(), { path: excluded })
    expect(result).toMatchObject({ ok: false, code: 'excluded' })
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it.each([['../outside.txt'], [path.join('..', 'outside.txt')], ['src/../../outside.txt']])(
    'refuses %s, which climbs out of the folder',
    async (escaping) => {
      const result = await readCodeFile(await open(), { path: escaping })
      expect(result).toMatchObject({ ok: false, code: 'outside' })
    },
  )

  it('refuses an absolute path, even one inside the folder', async () => {
    const result = await readCodeFile(await open(), { path: path.join(root, 'src/devices/archive.ts') })
    expect(result).toMatchObject({ ok: false, code: 'outside' })
  })

  it('refuses a symlink pointing outside the folder, or at an Excluded File inside it', async (context) => {
    try {
      fs.symlinkSync(path.join(base, 'outside.txt'), path.join(root, 'src/link.txt'))
      fs.symlinkSync(path.join(root, '.env'), path.join(root, 'src/config.txt'))
    } catch {
      context.skip() // creating symlinks needs Developer Mode or admin rights on Windows
    }
    const folder = await open()
    expect(await readCodeFile(folder, { path: 'src/link.txt' })).toMatchObject({ ok: false, code: 'outside' })
    expect(await readCodeFile(folder, { path: 'src/config.txt' })).toMatchObject({ ok: false, code: 'excluded' })
    const found = await searchCode(folder, { pattern: 'hunter2' })
    expect(found.matches).toEqual([])
    expect((await listCodeFiles(folder, {})).files).not.toContain('src/link.txt')
  })

  it('refuses a linked folder (junction) that leads outside the Code Folder', async () => {
    const elsewhere = path.join(base, 'elsewhere')
    fs.mkdirSync(elsewhere)
    fs.writeFileSync(path.join(elsewhere, 'notes.txt'), SECRET)
    // A junction needs no special rights on Windows; elsewhere it is an ordinary directory symlink.
    fs.symlinkSync(elsewhere, path.join(root, 'src', 'linked'), 'junction')
    const folder = await open()
    expect(await readCodeFile(folder, { path: 'src/linked/notes.txt' })).toMatchObject({ ok: false, code: 'outside' })
    expect((await listCodeFiles(folder, {})).files.some((file) => file.includes('linked'))).toBe(false)
    expect((await searchCode(folder, { pattern: 'hunter2' })).matches).toEqual([])
  })

  it('skips binary files', async () => {
    const folder = await open()
    expect(await readCodeFile(folder, { path: 'logo.png' })).toMatchObject({ ok: false, code: 'binary' })
    expect((await listCodeFiles(folder, {})).files).not.toContain('logo.png')
  })

  it('reports a missing file plainly', async () => {
    expect(await readCodeFile(await open(), { path: 'src/nope.ts' })).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('caps results and says so', async () => {
    for (let index = 0; index < 30; index++) write(`src/many/file${index}.ts`, 'export const needle = 1\n')
    write('src/big.ts', 'line\n'.repeat(READ_LIMITS.maxLines + 10))
    const folder = await open()
    expect(await listCodeFiles(folder, { limit: 5 })).toMatchObject({ truncated: true })
    expect((await listCodeFiles(folder, { limit: 5 })).files).toHaveLength(5)
    const found = await searchCode(folder, { pattern: 'needle', limit: 3 })
    expect(found).toMatchObject({ truncated: true })
    expect(found.matches).toHaveLength(3)
    const big = await readCodeFile(folder, { path: 'src/big.ts' })
    expect(big).toMatchObject({ ok: true, truncated: true, totalLines: READ_LIMITS.maxLines + 10 })
  })

  it('refuses a folder that no longer exists', async () => {
    await expect(openCodeFolder({ label: 'gone', path: path.join(base, 'gone'), extraExclusions: [] })).rejects.toThrow(
      'gone',
    )
  })
})

describe('Code Folder reader — in git', () => {
  it('applies the folder’s ignore rules on top of the fixed exclusions', async () => {
    write('.gitignore', 'dist/\nlocal-notes.md\n')
    write('dist/bundle.js', 'needle')
    write('local-notes.md', 'needle')
    write('src/tracked.ts', 'needle')
    git(root, 'init', '-q')
    const folder = await open([])
    const files = (await listCodeFiles(folder, {})).files
    expect(files).toContain('src/tracked.ts')
    expect(files).toContain('.gitignore')
    expect(files).not.toContain('dist/bundle.js')
    expect(files).not.toContain('local-notes.md')
    expect(files).not.toContain('.env')
    expect((await searchCode(folder, { pattern: 'needle' })).matches.map((match) => match.path)).toEqual([
      'src/tracked.ts',
    ])
    expect(await readCodeFile(folder, { path: 'dist/bundle.js' })).toMatchObject({ ok: false, code: 'excluded' })
  })
})
