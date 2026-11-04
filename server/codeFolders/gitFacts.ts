// Git facts about a Code Folder: whether it is in a git checkout, its branch, commit and uncommitted changes, and
// the files git does not ignore. Run by the backend, never by a session. A folder outside git — or a machine
// without git — yields "not in git", and then only the fixed and extra exclusions apply (ADR-0017).
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { GIT_BIN } from '../config.ts'

export interface GitOptions {
  /** The git binary; tests point it at a missing one. */
  gitBin?: string
}

export type GitState =
  | { available: boolean; inGit: false; hasIgnoreRules: false }
  | {
      available: true
      inGit: true
      /** null when HEAD is detached. */
      branch: string | null
      /** Short commit; '' before the first commit. */
      commit: string
      /** Changed, added, deleted and untracked-but-not-ignored files, within this folder only. */
      uncommitted: number
      hasIgnoreRules: boolean
      /** The remote's default branch, when the remote says. */
      suggestedDefaultBranch?: string
    }

/** Big enough for the file list of a large monorepo. */
const MAX_OUTPUT = 256 * 1024 * 1024

class GitMissing extends Error {}

/**
 * Runs git in the folder. fsmonitor is off so a repository's config can't make git run a program, and optional
 * locks are off so git never writes the human's index while they work.
 */
function run(folder: string, args: string[], { gitBin = GIT_BIN }: GitOptions): Promise<string | null> {
  return new Promise((resolve, reject) => {
    execFile(
      gitBin,
      ['-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false', ...args],
      {
        cwd: folder,
        encoding: 'utf8',
        maxBuffer: MAX_OUTPUT,
        windowsHide: true,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      },
      (error, stdout) => {
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') reject(new GitMissing())
        // A failing git command (not a repository, no commits yet, no remote) simply has no answer.
        else resolve(error ? null : stdout)
      },
    )
  })
}

const NOT_IN_GIT = (available: boolean): GitState => ({ available, inGit: false, hasIgnoreRules: false })

/** Whether any ignore rules reach the folder: a .gitignore in it or above it within the repository, or info/exclude. */
async function hasIgnoreRules(folder: string, topLevel: string, options: GitOptions) {
  let dir = folder
  while (true) {
    if (fs.existsSync(path.join(dir, '.gitignore'))) return true
    const parent = path.dirname(dir)
    if (path.relative(topLevel, dir) === '' || parent === dir) break
    dir = parent
  }
  const nested = await run(
    folder,
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.gitignore'],
    options,
  )
  if (nested?.split('\0').some((file) => path.posix.basename(file) === '.gitignore')) return true
  const exclude = (await run(folder, ['rev-parse', '--git-path', 'info/exclude'], options))?.trim()
  if (!exclude) return false
  const text = fs.readFileSync(path.resolve(folder, exclude), 'utf8')
  return text.split('\n').some((line) => line.trim() && !line.startsWith('#'))
}

export async function gitState(folder: string, options: GitOptions = {}): Promise<GitState> {
  try {
    const inside = await run(folder, ['rev-parse', '--is-inside-work-tree'], options)
    if (inside?.trim() !== 'true') return NOT_IN_GIT(true)
    const [topLevel, branch, commit, status, remoteHead] = await Promise.all([
      run(folder, ['rev-parse', '--show-toplevel'], options),
      run(folder, ['symbolic-ref', '--short', '-q', 'HEAD'], options),
      run(folder, ['rev-parse', '--short', 'HEAD'], options),
      run(folder, ['status', '--porcelain', '--untracked-files=all', '--', '.'], options),
      run(folder, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD'], options),
    ])
    const suggested = remoteHead?.trim().replace(/^[^/]+\//, '')
    return {
      available: true,
      inGit: true,
      branch: branch?.trim() || null,
      commit: commit?.trim() ?? '',
      uncommitted: (status ?? '').split('\n').filter((line) => line.trim()).length,
      hasIgnoreRules: await hasIgnoreRules(folder, path.resolve(topLevel?.trim() ?? folder), options),
      ...(suggested ? { suggestedDefaultBranch: suggested } : {}),
    }
  } catch (error) {
    if (error instanceof GitMissing) return NOT_IN_GIT(false)
    throw error
  }
}

/**
 * What git ignores in the folder, with wholly ignored folders collapsed to one "name/" entry — cheap even when
 * node_modules is huge. Empty when the folder is not in git. For the exclusion preview only.
 */
export async function ignoredEntries(folder: string, options: GitOptions = {}): Promise<string[]> {
  try {
    const listed = await run(
      folder,
      ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory', '--', '.'],
      options,
    )
    return (listed ?? '').split('\0').filter(Boolean)
  } catch (error) {
    if (error instanceof GitMissing) return []
    throw error
  }
}

/**
 * The files git does not ignore (tracked, or untracked but not ignored), slash-separated and relative to the
 * folder; null when the folder is not in git or git is missing.
 */
export async function notIgnoredFiles(folder: string, options: GitOptions = {}): Promise<Set<string> | null> {
  try {
    const inside = await run(folder, ['rev-parse', '--is-inside-work-tree'], options)
    if (inside?.trim() !== 'true') return null
    const listed = await run(
      folder,
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'],
      options,
    )
    if (listed === null) return null
    return new Set(listed.split('\0').filter(Boolean))
  } catch (error) {
    if (error instanceof GitMissing) return null
    throw error
  }
}
