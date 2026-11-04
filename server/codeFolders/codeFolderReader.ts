// Code Folder reader (ADR-0016): list, search and read over one Code Folder — the only code in the tool that
// touches Code Folder contents. Every path is resolved and symlink-checked against the folder, and the Excluded
// File policy (ADR-0017) is applied before anything is produced, so excluded content is never even read into a
// result. Results are capped, and a capped result says so.
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ExclusionGroup, ExclusionPreview } from '#core/codeFolder/codeFolderTypes.ts'
import {
  EXCLUSION_RULE_LABELS,
  exclusionOf,
  type ExclusionRule,
  FIXED_RULES,
  folderExcluded,
  type FolderExclusions,
  toFolderPath,
} from '#core/codeFolder/excludedFiles.ts'

import { type GitOptions, ignoredEntries, notIgnoredFiles } from './gitFacts.ts'

export const READ_LIMITS = {
  /** Lines one read returns at most. */
  maxLines: 2000,
  /** Bytes one read returns at most. */
  maxBytes: 256 * 1024,
  listDefault: 500,
  listMax: 2000,
  searchDefault: 100,
  searchMax: 500,
  /** A matching line longer than this is cut. */
  maxLineChars: 300,
  /** Files bigger than this are not searched. */
  maxSearchFileBytes: 1024 * 1024,
  /** Entries a walk of a folder outside git visits at most. */
  maxWalk: 200_000,
}

/** How the Project stores a Code Folder, as far as reading it goes. */
export interface CodeFolderSource {
  label: string
  path: string
  extraExclusions: string[]
}

/** A Code Folder opened for reading: its real root and what is excluded in it. */
export interface OpenCodeFolder {
  label: string
  root: string
  exclusions: FolderExclusions
}

export type ReadRefusal = {
  ok: false
  code: 'excluded' | 'outside' | 'not-found' | 'binary' | 'not-a-file'
  message: string
}
export type ReadResult = { ok: true; content: string; totalLines: number; truncated: boolean } | ReadRefusal

export interface SearchMatch {
  path: string
  line: number
  text: string
}

const BINARY_SNIFF_BYTES = 8000

const byName = (a: string, b: string) => a.localeCompare(b)

/** Resolves the folder's real path and what git ignores in it. A folder that no longer exists is an error. */
export async function openCodeFolder(source: CodeFolderSource, git: GitOptions = {}): Promise<OpenCodeFolder> {
  let root: string
  try {
    root = await fs.realpath(source.path)
  } catch {
    throw new Error(`Code Folder "${source.label}" is missing: nothing exists at ${source.path}.`)
  }
  const notIgnored = await notIgnoredFiles(root, git)
  return { label: source.label, root, exclusions: { notIgnored, extraPatterns: source.extraExclusions } }
}

function inside(root: string, target: string) {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

const refuse = (code: ReadRefusal['code'], message: string): ReadRefusal => ({ ok: false, code, message })

const isBinary = (bytes: Buffer) => bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)

/**
 * The real file behind a path the session asked for, or why it may not be read. Checked in this order: the
 * request itself (absolute, climbing), its exclusion, where it really leads, and the exclusion of that target.
 */
async function resolveFile(
  folder: OpenCodeFolder,
  requested: string,
): Promise<{ ok: true; file: string; rel: string } | ReadRefusal> {
  const outside = refuse(
    'outside',
    `"${requested}" is outside Code Folder ${folder.label}. Give a path relative to it, without "..".`,
  )
  if (path.isAbsolute(requested) || path.win32.isAbsolute(requested) || path.posix.isAbsolute(requested)) return outside
  const rel = toFolderPath(requested)
  if (rel.split('/').includes('..')) return outside
  const excluded = refuse(
    'excluded',
    `${folder.label}: ${rel} is an Excluded File — it can't be read, searched or listed. Don't try to work around this.`,
  )
  if (exclusionOf(rel, folder.exclusions)) return excluded
  let real: string
  try {
    real = await fs.realpath(path.join(folder.root, rel))
  } catch {
    return refuse('not-found', `${folder.label}: ${rel} does not exist.`)
  }
  if (!inside(folder.root, real)) return outside
  const realRel = toFolderPath(path.relative(folder.root, real))
  // A symlink inside the folder pointing at an Excluded File is that Excluded File.
  if (realRel !== rel && exclusionOf(realRel, folder.exclusions)) return excluded
  const stat = await fs.stat(real)
  if (!stat.isFile()) return refuse('not-a-file', `${folder.label}: ${rel} is a folder — list it instead.`)
  return { ok: true, file: real, rel }
}

/**
 * Every file of the folder outside git, walking without following symlinked folders and skipping excluded ones;
 * each skipped folder is reported to `onSkipped`.
 */
async function walk(folder: OpenCodeFolder, start: string, onSkipped?: (dirRel: string) => void): Promise<string[]> {
  const files: string[] = []
  const pending = [start]
  let visited = 0
  while (pending.length && visited < READ_LIMITS.maxWalk) {
    const dirRel = pending.shift()!
    // A folder that can't be listed (permissions, removed meanwhile) is skipped.
    const entries = await fs.readdir(path.join(folder.root, dirRel), { withFileTypes: true }).catch(() => [])
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      visited++
      const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!folderExcluded(rel, folder.exclusions)) pending.push(rel)
        else onSkipped?.(rel)
      } else if (entry.isFile() || entry.isSymbolicLink()) files.push(rel)
    }
  }
  return files
}

/** Candidate files (not yet checked for symlinks or binary content) within an optional subfolder. */
async function candidates(folder: OpenCodeFolder, subfolder = ''): Promise<string[]> {
  const sub = toFolderPath(subfolder).replace(/\/+$/, '')
  if (sub.split('/').includes('..') || path.isAbsolute(subfolder) || path.win32.isAbsolute(subfolder)) return []
  const all = folder.exclusions.notIgnored
    ? [...folder.exclusions.notIgnored].toSorted(byName)
    : await walk(folder, sub)
  const within = sub ? all.filter((file) => file === sub || file.startsWith(`${sub}/`)) : all
  return within.filter((file) => !exclusionOf(file, folder.exclusions))
}

function globMatcher(glob?: string) {
  const pattern = glob?.trim() ? toFolderPath(glob.trim().toLowerCase()) : ''
  if (!pattern) return () => true
  const full = pattern.includes('/') ? pattern : `**/${pattern}`
  return (file: string) => path.posix.matchesGlob(file.toLowerCase(), full)
}

const clamp = (value: number | undefined, fallback: number, max: number) =>
  Math.max(1, Math.min(max, Math.floor(value ?? fallback)))

/** The readable files' contents one by one, for searching; excluded, outside, binary and huge files are skipped. */
async function* readableContents(folder: OpenCodeFolder, files: string[]) {
  for (const rel of files) {
    const resolved = await resolveFile(folder, rel)
    if (!resolved.ok) continue
    const stat = await fs.stat(resolved.file)
    if (stat.size > READ_LIMITS.maxSearchFileBytes) continue
    const bytes = await fs.readFile(resolved.file)
    if (isBinary(bytes)) continue
    yield { rel, text: bytes.toString('utf8') }
  }
}

export async function listCodeFiles(
  folder: OpenCodeFolder,
  { subfolder, glob, limit }: { subfolder?: string; glob?: string; limit?: number },
): Promise<{ files: string[]; truncated: boolean }> {
  const max = clamp(limit, READ_LIMITS.listDefault, READ_LIMITS.listMax)
  const matches = globMatcher(glob)
  const files: string[] = []
  for (const rel of (await candidates(folder, subfolder)).filter(matches)) {
    const resolved = await resolveFile(folder, rel)
    if (!resolved.ok) continue
    const head = Buffer.alloc(BINARY_SNIFF_BYTES)
    const handle = await fs.open(resolved.file)
    const { bytesRead } = await handle.read(head, 0, BINARY_SNIFF_BYTES, 0).finally(() => handle.close())
    if (isBinary(head.subarray(0, bytesRead))) continue
    if (files.length === max) return { files, truncated: true }
    files.push(rel)
  }
  return { files, truncated: false }
}

function toRegExp(pattern: string) {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    // Not a valid regular expression: search for the text as written.
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  }
}

export async function searchCode(
  folder: OpenCodeFolder,
  { pattern, glob, limit }: { pattern: string; glob?: string; limit?: number },
): Promise<{ matches: SearchMatch[]; truncated: boolean }> {
  const max = clamp(limit, READ_LIMITS.searchDefault, READ_LIMITS.searchMax)
  const regex = toRegExp(pattern)
  const matches: SearchMatch[] = []
  const files = (await candidates(folder)).filter(globMatcher(glob))
  for await (const { rel, text } of readableContents(folder, files)) {
    const lines = text.split(/\r?\n/)
    for (let index = 0; index < lines.length; index++) {
      if (!regex.test(lines[index])) continue
      if (matches.length === max) return { matches, truncated: true }
      matches.push({ path: rel, line: index + 1, text: lines[index].slice(0, READ_LIMITS.maxLineChars) })
    }
  }
  return { matches, truncated: false }
}

export async function readCodeFile(
  folder: OpenCodeFolder,
  { path: requested, startLine, endLine }: { path: string; startLine?: number; endLine?: number },
): Promise<ReadResult> {
  const resolved = await resolveFile(folder, requested)
  if (!resolved.ok) return resolved
  const bytes = await fs.readFile(resolved.file)
  if (isBinary(bytes)) return refuse('binary', `${folder.label}: ${resolved.rel} is a binary file.`)
  const lines = bytes.toString('utf8').split(/\r?\n/)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const first = Math.max(1, Math.floor(startLine ?? 1))
  const wantedLast = Math.min(lines.length, Math.floor(endLine ?? lines.length))
  const last = Math.min(wantedLast, first + READ_LIMITS.maxLines - 1)
  const out: string[] = []
  let bytesOut = 0
  let truncated = last < wantedLast
  for (let number = first; number <= last; number++) {
    const line = `${number}\t${lines[number - 1]}`
    bytesOut += Buffer.byteLength(line) + 1
    if (bytesOut > READ_LIMITS.maxBytes) {
      truncated = true
      break
    }
    out.push(line)
  }
  return { ok: true, content: out.join('\n'), totalLines: lines.length, truncated }
}

const PREVIEW_EXAMPLES = 5
/** Files that stay readable on purpose, named in the preview so the human sees the exceptions work. */
const STILL_READABLE = new Set(['.env.example', '.env.sample', 'appsettings.json'])

/**
 * Which files are excluded, grouped by rule with a few examples each, and how many stay readable. Folders git
 * ignores wholesale (node_modules/) and folders skipped outside git count as one entry.
 */
export async function previewExclusions(folder: OpenCodeFolder, git: GitOptions = {}): Promise<ExclusionPreview> {
  const groups = new Map<ExclusionRule, ExclusionGroup>()
  const add = (rule: ExclusionRule, entry: string) => {
    const group = groups.get(rule) ?? {
      rule,
      label: EXCLUSION_RULE_LABELS[rule],
      fixed: FIXED_RULES.includes(rule),
      count: 0,
      examples: [],
    }
    group.count++
    if (group.examples.length < PREVIEW_EXAMPLES) group.examples.push(entry)
    groups.set(rule, group)
  }
  const fixedOnly: FolderExclusions = { notIgnored: null, extraPatterns: [] }
  let files: string[]
  if (folder.exclusions.notIgnored) {
    files = [...folder.exclusions.notIgnored].toSorted(byName)
    for (const entry of await ignoredEntries(folder.root, git))
      add(exclusionOf(entry.replace(/\/$/, ''), fixedOnly) ?? 'ignored', entry)
  } else {
    files = await walk(folder, '', (dir) => add(exclusionOf(`${dir}/-`, fixedOnly) ?? 'extra', `${dir}/`))
  }
  let readable = 0
  const stillReadable: string[] = []
  for (const file of files) {
    const rule = exclusionOf(file, folder.exclusions)
    if (rule) add(rule, file)
    else {
      readable++
      if (STILL_READABLE.has(path.posix.basename(file).toLowerCase())) stillReadable.push(file)
    }
  }
  const order = Object.keys(EXCLUSION_RULE_LABELS)
  return {
    readable,
    groups: [...groups.values()].sort((a, b) => order.indexOf(a.rule) - order.indexOf(b.rule)),
    stillReadable,
  }
}
