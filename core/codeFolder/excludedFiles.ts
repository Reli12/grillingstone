// Excluded File policy (ADR-0017): may this path inside a Code Folder be read, searched or listed? Three layers,
// each of which can only exclude more: a fixed floor nobody can lift, the folder's own ignore rules, and the
// human's extra patterns. Pure — the caller supplies what git reports.
import path from 'node:path'

/** Why a path is excluded; null means it may be read. */
export type ExclusionRule =
  'environment' | 'key' | 'credentials' | 'settings' | 'named-secret' | 'vcs' | 'ignored' | 'extra'

export interface FolderExclusions {
  /**
   * The files git reports as not ignored (tracked, or untracked but not ignored), as slash-separated paths
   * relative to the Code Folder; null when the folder is not in git, so no ignore rules apply.
   */
  notIgnored: ReadonlySet<string> | null
  /** The human's extra patterns for this Code Folder. */
  extraPatterns: readonly string[]
}

/** Human-readable names of the rules, for the exclusion preview. */
export const EXCLUSION_RULE_LABELS: Record<ExclusionRule, string> = {
  environment: 'Environment files',
  key: 'Keys and certificates',
  credentials: 'Registry and tool credentials',
  settings: 'Environment-specific settings',
  'named-secret': 'Named secret or credential',
  vcs: 'Version-control internals',
  ignored: 'Ignored by git',
  extra: 'Your extra patterns',
}

/** The rules that can never be lifted. */
export const FIXED_RULES: readonly ExclusionRule[] = [
  'environment',
  'key',
  'credentials',
  'settings',
  'named-secret',
  'vcs',
]

const ENV_EXAMPLES = new Set(['.env.example', '.env.sample'])
const KEY_EXTENSIONS = new Set(['.pem', '.key', '.pfx', '.p12', '.crt'])
const KEY_NAMES = /^(id_rsa|id_ed25519)/
const CREDENTIAL_FILES = new Set(['.npmrc', '.yarnrc.yml', '.pypirc', '.netrc', '.git-credentials'])
const SETTINGS_FILES = /^(appsettings\..+\.json|local\.settings\.json)$/
const NAMED_SECRET = /secret|credential/

/** Slash-separated, without leading "./" or slashes; letter case kept (git reports it as on disk). */
export const toFolderPath = (filePath: string) =>
  filePath
    .replaceAll('\\', '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')

function fixedRule(segments: string[]): ExclusionRule | null {
  const name = segments[segments.length - 1]
  if (segments.includes('.git')) return 'vcs'
  if ((name === '.env' || name.startsWith('.env.')) && !ENV_EXAMPLES.has(name)) return 'environment'
  if (KEY_EXTENSIONS.has(path.posix.extname(name)) || KEY_NAMES.test(name)) return 'key'
  if (CREDENTIAL_FILES.has(name)) return 'credentials'
  if (SETTINGS_FILES.test(name)) return 'settings'
  if (segments.some((segment) => NAMED_SECRET.test(segment))) return 'named-secret'
  return null
}

/** gitignore-like: a pattern without a slash matches a file or folder name at any depth; otherwise from the root. */
function matchesExtra(lowerPath: string, pattern: string) {
  const glob = toFolderPath(pattern.trim().toLowerCase()).replace(/\/+$/, '')
  if (!glob) return false
  const candidates = glob.includes('/') ? [glob, `${glob}/**`] : [`**/${glob}`, `**/${glob}/**`]
  return candidates.some((candidate) => path.posix.matchesGlob(lowerPath, candidate))
}

/**
 * Whether a whole folder can be skipped: version-control internals, anything named as a secret, or a folder an
 * extra pattern covers. Ignore rules are not checked here — a folder in git is never walked, git lists its files.
 */
export function folderExcluded(dirPath: string, folder: FolderExclusions): boolean {
  const lower = toFolderPath(dirPath).replace(/\/+$/, '').toLowerCase()
  const segments = lower.split('/')
  if (segments.includes('.git') || segments.some((segment) => NAMED_SECRET.test(segment))) return true
  return folder.extraPatterns.some((pattern) => matchesExtra(lower, pattern) || matchesExtra(`${lower}/-`, pattern))
}

/** The rule that excludes this file, or null when a session may read it. */
export function exclusionOf(filePath: string, folder: FolderExclusions): ExclusionRule | null {
  const relative = toFolderPath(filePath)
  const lower = relative.toLowerCase()
  const fixed = fixedRule(lower.split('/'))
  if (fixed) return fixed
  if (folder.notIgnored && !folder.notIgnored.has(relative)) return 'ignored'
  if (folder.extraPatterns.some((pattern) => matchesExtra(lower, pattern))) return 'extra'
  return null
}
