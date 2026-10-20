// The Codex sandbox profile (ADR-0019): what a Codex session's commands may read and write, enforced by the
// operating system. It reaches `codex app-server` as `-c` overrides at start; thread/start config cannot carry it.
import path from 'node:path'

import { DECISIONS_FOLDER, GLOSSARY_FILE } from '#core/session/permissionGuard.ts'
import { PROJECT_APP_ENTRIES } from '#core/shared/projectFolder.ts'

export interface ProfileInput {
  /** Absolute Project folder (a Template Session's own empty working folder). */
  projectDir: string
  /** A Template Session writes nothing. */
  mode: 'grilling' | 'template'
  /** The session's own writable temp folder. */
  sessionTmp: string
  /** Folders commands need to read to run at all, worked out per machine (the Node install Codex lives in). */
  runtimeReadPaths: string[]
  /** The sandbox differs by operating system: Linux's cannot grant writes to a single file. */
  platform: NodeJS.Platform
  /** Codex's own home (sign-in, threads, helpers); only its sandbox helper folder is ever readable, on Linux. */
  codexHome: string
}

type Access = 'read' | 'write' | 'deny'

export interface Profile {
  workspace_roots: Record<string, true>
  filesystem: Record<string, Access | Record<string, Access>>
}

/** The profile's name inside Codex's config. */
const PROFILE_NAME = 'grillingstone'
/** Inside the Project, a Grilling Session writes only its Glossary and its decision records. */
const GRILLING_WRITES = { '.': 'read', [GLOSSARY_FILE]: 'write', [DECISIONS_FOLDER]: 'write' } as const

/**
 * Linux's sandbox (bubblewrap) can't grant writes to a single file: it guards a `.git` inside every writable path,
 * so a writable CONTEXT.md breaks every command. There a Grilling Session writes its Project folder, while the
 * app's own entries stay read-only and instruction files stay shut; Drafts still change only through submission.
 */
const LINUX_GRILLING_WRITES = {
  '.': 'write',
  ...Object.fromEntries(PROJECT_APP_ENTRIES.map((entry) => [entry, 'read' as const])),
  // Codex reads these as instructions from its working folder; a session must not plant them for the next one.
  'AGENTS.md': 'deny',
  'AGENTS.override.md': 'deny',
} as const satisfies Record<string, Access>

/**
 * With the system bubblewrap, Linux starts Codex's sandbox helper from its home's tmp/arg0, so commands can't run
 * unless that folder is readable. It holds only Codex's helper programs; the rest of the home, sign-in included,
 * stays denied.
 */
const linuxHelperPaths = (codexHome: string, platform: NodeJS.Platform) =>
  platform === 'linux' ? [path.join(codexHome, 'tmp', 'arg0')] : []

/** What a session may do inside its working folder. A Template Session writes nothing on any platform. */
function workspaceAccess(mode: ProfileInput['mode'], platform: NodeJS.Platform) {
  if (mode === 'template') return { '.': 'read' } as const
  return platform === 'linux' ? LINUX_GRILLING_WRITES : GRILLING_WRITES
}

/** Deny the whole disk, then open what a command needs to start; the system temp folders stay shut. */
const BASE_FILESYSTEM = { ':root': 'deny', ':minimal': 'read', ':tmpdir': 'deny', ':slash_tmp': 'deny' } as const

export function codexConfig({
  projectDir,
  mode,
  sessionTmp,
  runtimeReadPaths,
  platform,
  codexHome,
}: ProfileInput): Record<string, unknown> {
  const readPaths = [...runtimeReadPaths, ...linuxHelperPaths(codexHome, platform)]
  const runtime = Object.fromEntries(readPaths.map((dir) => [dir, { '.': 'read' as const }]))
  // No network table: commands run without network, while Codex's own web search is set apart from the sandbox.
  const profile: Profile = {
    workspace_roots: { [projectDir]: true },
    filesystem: {
      ...BASE_FILESYSTEM,
      ':workspace_roots': workspaceAccess(mode, platform),
      ...runtime,
      [sessionTmp]: { '.': 'write' },
    },
  }
  return {
    default_permissions: PROFILE_NAME,
    [`permissions.${PROFILE_NAME}`]: profile,
    // Shells write heredocs to a temp file (bash to $TMPDIR, zsh to $TMPPREFIX), and the system ones are denied.
    'shell_environment_policy.set.TMPDIR': sessionTmp,
    'shell_environment_policy.set.TMPPREFIX': path.join(sessionTmp, 'zsh'),
    web_search: 'live',
  }
}

/**
 * One value in TOML, the form `-c` expects. Strings and keys are written as JSON strings, which TOML reads as
 * basic strings; an object becomes an inline table.
 */
function toml(value: unknown): string {
  if (typeof value !== 'object' || value === null) return JSON.stringify(value)
  const pairs = Object.entries(value).map(([key, inner]) => `${JSON.stringify(key)} = ${toml(inner)}`)
  return `{ ${pairs.join(', ')} }`
}

/** The config as `-c key=value` arguments for `codex app-server`. */
export function configArgs(config: Record<string, unknown>): string[] {
  return Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${toml(value)}`])
}
