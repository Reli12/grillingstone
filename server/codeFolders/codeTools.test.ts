// Tests for the three code tools a session calls (ADR-0016): which Code Folder a label names, what Claude reads
// back, and that a session only reaches the folders it was started with.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { CodeFolder } from '#core/codeFolder/codeFolderTypes.ts'

import { makeTestFolder } from '../../test/server/testFolders.ts'
import { CODE_TOOL_NAMES, runCodeTool } from './codeTools.ts'

let base: string
let folders: CodeFolder[]

const write = (relative: string, content: string) => {
  const file = path.join(base, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

beforeEach(() => {
  base = makeTestFolder('gs-tools')
  write('app/src/devices/DeviceList.tsx', 'export const DeviceList = () => null // devices\n')
  write('app/.env', 'TOKEN=hunter2\n')
  write('ui/src/Badge.tsx', 'export const Badge = () => null // devices badge\n')
  folders = [
    { id: 'cf-1', label: 'app', path: path.join(base, 'app'), defaultBranch: 'main', extraExclusions: [] },
    { id: 'cf-2', label: 'ui', path: path.join(base, 'ui'), defaultBranch: 'main', extraExclusions: [] },
  ]
})
afterEach(() => fs.rmSync(base, { recursive: true, force: true }))

describe('code tools', () => {
  it('names exactly three read-only tools', () => {
    expect(CODE_TOOL_NAMES).toEqual(['list_code_files', 'search_code', 'read_code_file'])
  })

  it('lists one folder’s files, cited by label', async () => {
    const result = await runCodeTool(folders, 'list_code_files', { folder: 'app' })
    expect(result).toEqual({ isError: false, text: 'app: src/devices/DeviceList.tsx' })
  })

  it('searches one folder, or every folder when none is named', async () => {
    const one = await runCodeTool(folders, 'search_code', { folder: 'ui', pattern: 'devices' })
    expect(one.text).toBe('ui: src/Badge.tsx:1: export const Badge = () => null // devices badge')
    const all = await runCodeTool(folders, 'search_code', { pattern: 'devices' })
    expect(all.text.split('\n')).toEqual([
      'app: src/devices/DeviceList.tsx:1: export const DeviceList = () => null // devices',
      'ui: src/Badge.tsx:1: export const Badge = () => null // devices badge',
    ])
  })

  it('reads a file with line numbers under a heading that cites it', async () => {
    const result = await runCodeTool(folders, 'read_code_file', { folder: 'app', path: 'src/devices/DeviceList.tsx' })
    expect(result).toEqual({
      isError: false,
      text: 'app: src/devices/DeviceList.tsx (1 line)\n1\texport const DeviceList = () => null // devices',
    })
  })

  it('tells the session an Excluded File is excluded, without its content', async () => {
    const result = await runCodeTool(folders, 'read_code_file', { folder: 'app', path: '.env' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Excluded File')
    expect(result.text).not.toContain('hunter2')
    const searched = await runCodeTool(folders, 'search_code', { pattern: 'hunter2' })
    expect(searched).toEqual({ isError: false, text: 'No matches.' })
  })

  it('refuses a label the session was not given, naming the ones it has', async () => {
    const result = await runCodeTool([folders[0]], 'read_code_file', { folder: 'ui', path: 'src/Badge.tsx' })
    expect(result).toEqual({ isError: true, text: 'No Code Folder "ui" in this session. Available: app.' })
  })

  it('says when results were cut', async () => {
    for (let index = 0; index < 5; index++) write(`app/src/many/f${index}.ts`, 'devices\n')
    const result = await runCodeTool(folders, 'search_code', { folder: 'app', pattern: 'devices', limit: 2 })
    expect(result.text.split('\n')).toHaveLength(3)
    expect(result.text).toMatch(/More matches exist — narrow the pattern or add a glob\.$/)
  })

  it('refuses an unknown tool and malformed input', async () => {
    expect((await runCodeTool(folders, 'write_code_file', { folder: 'app' })).isError).toBe(true)
    expect((await runCodeTool(folders, 'read_code_file', { folder: 'app' })).text).toBe('read_code_file needs a path.')
    expect((await runCodeTool(folders, 'search_code', { folder: 'app' })).text).toBe('search_code needs a pattern.')
  })

  it('reports a folder that went missing during the session', async () => {
    fs.rmSync(path.join(base, 'ui'), { recursive: true })
    const result = await runCodeTool(folders, 'list_code_files', { folder: 'ui' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('missing')
  })
})
