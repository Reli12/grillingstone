// The three code tools a Grilling Session may call (ADR-0016), as scripts/codeTools.mjs forwards them: which Code
// Folder a label names, and the plain text Claude reads back — every line cited as "label: path".
import type { CodeFolder } from '#core/codeFolder/codeFolderTypes.ts'
import { CODE_TOOL_NAMES } from '#core/session/permissionGuard.ts'

import { listCodeFiles, openCodeFolder, readCodeFile, searchCode } from './codeFolderReader.ts'

export { CODE_TOOL_NAMES }

export interface CodeToolResult {
  text: string
  isError: boolean
}

const ok = (text: string): CodeToolResult => ({ text, isError: false })
const error = (text: string): CodeToolResult => ({ text, isError: true })

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/** The folders a call names: one by its label, or all of them; `refused` says why a label names none. */
function pick(folders: CodeFolder[], label: string | undefined): { chosen: CodeFolder[]; refused?: CodeToolResult } {
  if (label === undefined) return { chosen: folders }
  const folder = folders.find((candidate) => candidate.label === label)
  if (folder) return { chosen: [folder] }
  const available = folders.map((candidate) => candidate.label).join(', ') || 'none'
  return { chosen: [], refused: error(`No Code Folder "${label}" in this session. Available: ${available}.`) }
}

async function list(folders: CodeFolder[], input: Record<string, unknown>) {
  const lines: string[] = []
  let truncated = false
  for (const folder of folders) {
    const listed = await listCodeFiles(await openCodeFolder(folder), {
      subfolder: str(input.subfolder),
      glob: str(input.glob),
      limit: num(input.limit),
    })
    lines.push(...listed.files.map((file) => `${folder.label}: ${file}`))
    truncated ||= listed.truncated
  }
  if (!lines.length) return ok('No files.')
  return ok(truncated ? `${lines.join('\n')}\nMore files exist — list a subfolder or add a glob.` : lines.join('\n'))
}

async function search(folders: CodeFolder[], input: Record<string, unknown>) {
  const pattern = str(input.pattern)
  if (!pattern) return error('search_code needs a pattern.')
  const lines: string[] = []
  let truncated = false
  for (const folder of folders) {
    const found = await searchCode(await openCodeFolder(folder), {
      pattern,
      glob: str(input.glob),
      limit: num(input.limit),
    })
    lines.push(...found.matches.map((match) => `${folder.label}: ${match.path}:${match.line}: ${match.text}`))
    truncated ||= found.truncated
  }
  if (!lines.length) return ok('No matches.')
  return ok(
    truncated ? `${lines.join('\n')}\nMore matches exist — narrow the pattern or add a glob.` : lines.join('\n'),
  )
}

async function read(folders: CodeFolder[], input: Record<string, unknown>) {
  const filePath = str(input.path)
  if (!filePath) return error('read_code_file needs a path.')
  if (folders.length !== 1) return error('read_code_file needs the folder label too.')
  const [folder] = folders
  const result = await readCodeFile(await openCodeFolder(folder), {
    path: filePath,
    startLine: num(input.startLine),
    endLine: num(input.endLine),
  })
  if (!result.ok) return error(result.message)
  const lines = `${result.totalLines} line${result.totalLines === 1 ? '' : 's'}`
  const cut = result.truncated ? '\n[Cut here — read on with startLine.]' : ''
  return ok(`${folder.label}: ${filePath.replaceAll('\\', '/')} (${lines})\n${result.content}${cut}`)
}

/** Runs one code tool over the Code Folders the session was started with; nothing else is reachable. */
export async function runCodeTool(
  folders: CodeFolder[],
  tool: string,
  input: Record<string, unknown>,
): Promise<CodeToolResult> {
  if (!(CODE_TOOL_NAMES as readonly string[]).includes(tool)) return error(`There is no code tool "${tool}".`)
  const { chosen, refused } = pick(folders, str(input.folder))
  if (refused) return refused
  try {
    if (tool === 'list_code_files') return await list(chosen, input)
    if (tool === 'search_code') return await search(chosen, input)
    return await read(chosen, input)
  } catch (failure) {
    // A Code Folder that disappeared during the session, or a file removed mid-read.
    return error(failure instanceof Error ? failure.message : String(failure))
  }
}
