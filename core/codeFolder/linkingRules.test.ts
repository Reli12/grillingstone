// Tests for the Code Folder linking rules: which folders are refused, which are warned about, and labels.
import { describe, expect, it } from 'vitest'

import { checkCodeFolderPath, checkLabel, type FolderFacts, LARGE_FOLDER_FILES } from '#core/codeFolder/linkingRules.ts'

const windows = (folder: string, more: Partial<FolderFacts> = {}): FolderFacts => ({
  path: folder,
  platform: 'win32',
  homeDir: 'C:\\Users\\dev',
  dataDir: 'C:\\tools\\grillingstone\\data',
  exists: true,
  isDirectory: true,
  git: { available: true, inGit: true, hasIgnoreRules: true },
  fileCount: 1200,
  ...more,
})

const posix = (folder: string, more: Partial<FolderFacts> = {}): FolderFacts => ({
  ...windows(folder, more),
  platform: 'posix',
  homeDir: '/home/dev',
  dataDir: '/home/dev/tools/grillingstone/data',
  ...more,
})

const codes = (facts: FolderFacts) => {
  const check = checkCodeFolderPath(facts)
  return check.status === 'rejected' ? check.reasons.map((reason) => reason.code) : []
}
const warnings = (facts: FolderFacts) => {
  const check = checkCodeFolderPath(facts)
  return check.status === 'ok-with-warnings' ? check.warnings.map((reason) => reason.code) : []
}

describe('Code Folder linking rules', () => {
  it('accepts an ordinary source folder', () => {
    expect(checkCodeFolderPath(windows('C:\\work\\client\\app'))).toEqual({ status: 'ok' })
    expect(checkCodeFolderPath(posix('/home/dev/work/app'))).toEqual({ status: 'ok' })
    expect(checkCodeFolderPath(windows('D:\\repos\\monorepo\\packages\\ui\\'))).toEqual({ status: 'ok' })
  })

  it('refuses a path that does not exist or is not a folder', () => {
    expect(codes(windows('C:\\work\\gone', { exists: false }))).toEqual(['missing'])
    expect(codes(windows('C:\\work\\file.txt', { isDirectory: false }))).toEqual(['not-a-folder'])
  })

  it.each([['C:\\'], ['c:'], ['D:/'], ['C:\\\\']])('refuses the drive root %s', (root) => {
    expect(codes(windows(root))).toContain('drive-root')
  })

  it('refuses the POSIX root', () => {
    expect(codes(posix('/'))).toContain('drive-root')
  })

  it.each([
    ['C:\\Windows'],
    ['c:\\windows\\System32'],
    ['C:\\Program Files\\nodejs'],
    ['C:\\Program Files (x86)'],
    ['C:\\ProgramData\\x'],
  ])('refuses the Windows system folder %s', (folder) => {
    expect(codes(windows(folder))).toContain('system-folder')
  })

  it.each([['/etc'], ['/usr/local/lib'], ['/System/Library'], ['/var/log']])(
    'refuses the POSIX system folder %s',
    (folder) => expect(codes(posix(folder))).toContain('system-folder'),
  )

  it('refuses the home folder and anything containing it, case-insensitively on Windows', () => {
    expect(codes(windows('C:\\Users\\dev'))).toContain('home-folder')
    expect(codes(windows('c:\\users\\DEV\\'))).toContain('home-folder')
    expect(codes(windows('C:\\Users'))).toContain('home-folder')
    expect(codes(posix('/home'))).toContain('home-folder')
    // Inside the home folder is fine.
    expect(codes(windows('C:\\Users\\dev\\work\\app'))).toEqual([])
  })

  it('treats POSIX paths case-sensitively', () => {
    expect(codes(posix('/home/Dev'))).toEqual([])
  })

  it('refuses a folder that overlaps the tool’s data, either way round', () => {
    expect(codes(windows('C:\\tools\\grillingstone'))).toContain('tool-data')
    expect(codes(windows('C:\\tools\\grillingstone\\data\\projects\\p-1'))).toContain('tool-data')
    expect(codes(windows('c:\\TOOLS\\grillingstone\\DATA'))).toContain('tool-data')
    expect(codes(windows('C:\\tools\\grillingstone-docs'))).toEqual([])
  })

  it('warns about a folder outside git, without ignore rules, or very large', () => {
    expect(warnings(windows('C:\\x', { git: { available: true, inGit: false, hasIgnoreRules: false } }))).toEqual([
      'not-in-git',
      'no-ignore-rules',
    ])
    expect(warnings(windows('C:\\x', { git: { available: true, inGit: true, hasIgnoreRules: false } }))).toEqual([
      'no-ignore-rules',
    ])
    expect(warnings(windows('C:\\x', { fileCount: LARGE_FOLDER_FILES + 1 }))).toEqual(['large'])
    expect(warnings(windows('C:\\x', { fileCount: LARGE_FOLDER_FILES }))).toEqual([])
  })

  it('says when git itself is not installed', () => {
    const check = checkCodeFolderPath(
      windows('C:\\x', { git: { available: false, inGit: false, hasIgnoreRules: false } }),
    )
    expect(check.status).toBe('ok-with-warnings')
    if (check.status !== 'ok-with-warnings') return
    expect(check.warnings[0].code).toBe('no-git-installed')
  })

  it('does not warn about a refused folder', () => {
    const check = checkCodeFolderPath(
      windows('C:\\', { git: { available: true, inGit: false, hasIgnoreRules: false } }),
    )
    expect(check.status).toBe('rejected')
  })
})

describe('Code Folder labels', () => {
  it('accepts a short unique slug', () => {
    expect(checkLabel('app', [])).toBeNull()
    expect(checkLabel('ui-lib2', ['app'])).toBeNull()
  })

  it.each([[''], ['App'], ['ui lib'], ['-app'], ['x'.repeat(25)], ['app/']])('refuses the label "%s"', (label) => {
    expect(checkLabel(label, [])?.code).toBe('label-format')
  })

  it('refuses a label another Code Folder of the Project uses', () => {
    expect(checkLabel('app', ['ui', 'app'])?.code).toBe('label-taken')
  })
})
