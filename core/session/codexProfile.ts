// The Codex sandbox profile (ADR-0019): what a Codex session's commands may read and write, enforced by the
// operating system. It reaches `codex app-server` as `-c` overrides at start; thread/start config cannot carry it.
import path from 'node:path'

import { DECISIONS_FOLDER, GLOSSARY_FILE } from '#core/session/permissionGuard.ts'

export interface ProfileInput {
  /** Absolute Project folder (a Template Session's own empty working folder). */
  projectDir: string
  /** A Template Session writes nothing. */
  mode: 'grilling' | 'template'
  /** The session's own writable temp folder. */
  sessionTmp: string
  /** Folders commands need to read to run at all, worked out per machine (the Node install Codex lives in). */
  runtimeReadPaths: string[]
}

type Access = 'read' | 'write' | 'deny'

export interface Profile {
  workspace_roots: Record<string, true>
  filesystem: Record<string, Access | Record<string, Access>>
}

/** The profile's name inside Codex's config. */
const PROFILE_NAME = 'grillingstone'
/** Inside the Project, a Grilling Session writes only its Glossary and its decision records. */
const GRILLING_WRITES = { [GLOSSARY_FILE]: 'write', [DECISIONS_FOLDER]: 'write' } as const

/** Deny the whole disk, then open what a command needs to start; the system temp folders stay shut. */
const BASE_FILESYSTEM = { ':root': 'deny', ':minimal': 'read', ':tmpdir': 'deny', ':slash_tmp': 'deny' } as const

export function codexConfig({ projectDir, mode, sessionTmp, runtimeReadPaths }: ProfileInput): Record<string, unknown> {
  const writes = mode === 'grilling' ? GRILLING_WRITES : {}
  const runtime = Object.fromEntries(runtimeReadPaths.map((dir) => [dir, { '.': 'read' as const }]))
  // No network table: commands run without network, while Codex's own web search is set apart from the sandbox.
  const profile: Profile = {
    workspace_roots: { [projectDir]: true },
    filesystem: {
      ...BASE_FILESYSTEM,
      ':workspace_roots': { '.': 'read', ...writes },
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
