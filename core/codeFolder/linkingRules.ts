// Code Folder linking rules: whether a proposed folder may be linked to a Project. Pure — the caller resolves
// the facts about the path (exists, git, file count), so the rules are testable without a filesystem.
import path from 'node:path'

import type { Reason } from '#core/shared/validation.ts'

/** More files than this (Excluded Files not counted) earns a warning. */
export const LARGE_FOLDER_FILES = 50_000

export interface GitFolderFacts {
  /** Whether git is installed at all; without it every folder counts as not in git. */
  available: boolean
  inGit: boolean
  /** Whether any ignore rules apply to the folder (a .gitignore in it or above it within the repo). */
  hasIgnoreRules: boolean
}

export interface FolderFacts {
  /** The path as resolved (absolute); trailing separators are fine. */
  path: string
  platform: 'win32' | 'posix'
  homeDir: string
  /** The tool's own data folder. */
  dataDir: string
  exists: boolean
  isDirectory: boolean
  git: GitFolderFacts
  /** Readable files, Excluded Files not counted. */
  fileCount: number
}

export type LinkCheck =
  { status: 'ok' } | { status: 'ok-with-warnings'; warnings: Reason[] } | { status: 'rejected'; reasons: Reason[] }

const WINDOWS_SYSTEM = ['windows', 'program files', 'program files (x86)', 'programdata']
const POSIX_SYSTEM = [
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib64',
  '/proc',
  '/sbin',
  '/sys',
  '/usr',
  '/var',
  '/System',
  '/Library',
  '/private',
]

const reason = (code: string, message: string): Reason => ({ code, message })

/** Path helpers for the folder's platform: normalised, without a trailing separator, case-folded on Windows. */
function pathsFor(platform: FolderFacts['platform']) {
  const lib = platform === 'win32' ? path.win32 : path.posix
  const normal = (value: string) => {
    // A bare "C:" means the current folder on drive C to Windows, but a human pasting it means the drive.
    const drive = platform === 'win32' && /^[a-z]:$/i.test(value.trim()) ? `${value.trim()}\\` : value
    let resolved = lib.resolve(drive)
    const root = lib.parse(resolved).root
    while (resolved.length > root.length && /[\\/]$/.test(resolved)) resolved = resolved.slice(0, -1)
    return platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  const isRoot = (value: string) => {
    const resolved = normal(value)
    return resolved === lib.parse(resolved).root
  }
  /** Whether `inner` is `outer` or inside it. */
  const within = (outer: string, inner: string) => {
    const rel = lib.relative(normal(outer), normal(inner))
    return rel === '' || (!rel.startsWith('..') && !lib.isAbsolute(rel))
  }
  return { lib, normal, isRoot, within }
}

function isSystemFolder(facts: FolderFacts, paths: ReturnType<typeof pathsFor>) {
  if (facts.platform === 'posix') return POSIX_SYSTEM.some((system) => paths.within(system, facts.path))
  const resolved = paths.normal(facts.path)
  const root = paths.lib.parse(resolved).root
  const first = resolved.slice(root.length).split('\\')[0]
  return WINDOWS_SYSTEM.includes(first)
}

function rejections(facts: FolderFacts): Reason[] {
  if (!facts.exists) return [reason('missing', 'No folder exists at this path.')]
  if (!facts.isDirectory) return [reason('not-a-folder', 'This path is a file, not a folder.')]
  const paths = pathsFor(facts.platform)
  const reasons: Reason[] = []
  if (paths.isRoot(facts.path))
    reasons.push(reason('drive-root', 'It is a drive root — linking it would expose the whole drive.'))
  else if (isSystemFolder(facts, paths)) reasons.push(reason('system-folder', 'It is a system folder.'))
  if (paths.within(facts.path, facts.homeDir))
    reasons.push(
      reason('home-folder', 'It is your home folder or contains it — link the project folder inside it instead.'),
    )
  if (paths.within(facts.path, facts.dataDir) || paths.within(facts.dataDir, facts.path))
    reasons.push(
      reason('tool-data', 'It overlaps the tool’s own data, which holds other Projects’ Drafts and transcripts.'),
    )
  return reasons
}

function warningsFor(facts: FolderFacts): Reason[] {
  const warnings: Reason[] = []
  if (!facts.git.available)
    warnings.push(
      reason(
        'no-git-installed',
        'git is not installed, so no branch information or ignore rules are available — only the fixed exclusions and your patterns apply.',
      ),
    )
  else if (!facts.git.inGit)
    warnings.push(reason('not-in-git', 'It is not inside a git checkout — sessions get no branch information.'))
  if (facts.git.available && !facts.git.hasIgnoreRules)
    warnings.push(
      reason('no-ignore-rules', 'It has no ignore rules — only the fixed exclusions and your patterns protect it.'),
    )
  if (facts.fileCount > LARGE_FOLDER_FILES)
    warnings.push(
      reason(
        'large',
        `It holds ${facts.fileCount.toLocaleString('en')} readable files — you may have linked more than you meant to.`,
      ),
    )
  return warnings
}

/** Refused, warned about, or fine. A refused folder gets no warnings: they would not matter. */
export function checkCodeFolderPath(facts: FolderFacts): LinkCheck {
  const reasons = rejections(facts)
  if (reasons.length) return { status: 'rejected', reasons }
  const warnings = warningsFor(facts)
  return warnings.length ? { status: 'ok-with-warnings', warnings } : { status: 'ok' }
}

const LABEL = /^[a-z0-9][a-z0-9-]{0,23}$/

/** Why a label can't be used, or null. Labels are how Claude cites code ("app: src/…"). */
export function checkLabel(label: string, otherLabels: readonly string[]): Reason | null {
  if (!LABEL.test(label))
    return reason(
      'label-format',
      'Use a short label of lowercase letters, digits and dashes (up to 24), e.g. "app" or "ui-lib".',
    )
  if (otherLabels.includes(label))
    return reason('label-taken', `Another Code Folder in this Project is already labelled "${label}".`)
  return null
}
