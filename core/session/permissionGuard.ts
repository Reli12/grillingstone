// Permission Guard (ADR-0006): the decision behind the PreToolUse hook of every headless session.
// Deny by default. Pattern-based permissions alone are bypassable, so paths are normalised and
// symlink-resolved, and the single allowed Bash command is matched exactly.
import path from 'node:path'

import { PROTOTYPE_FILE } from '#core/prototype/prototypeFiles.ts'
import { submitPayloadFile } from '#core/session/cardProtocol.ts'

export interface GuardContext {
  /** Absolute, symlink-resolved Project folder. */
  projectDir: string
  /** Absolute path of scripts/writeDraft.mjs. */
  submitScript: string
  /** The session's id, which names its one writable submission file. */
  sessionId: string
  /** Resolves symlinks (for paths that do not exist yet: of their longest existing ancestor). */
  realpath: (filePath: string) => string
  /**
   * A Template Session writes only its payload file and loads no skills; its folder is its own working folder.
   * A Prototype Session writes only `prototype.html` and its payload file, loads no skills and reaches no web.
   */
  mode?: GuardMode
  /** The session was started with "Read Code Folders": the code tools are allowed (ADR-0016). */
  codeFolders?: boolean
}

export type GuardMode = 'grilling' | 'template' | 'prototype'

/** The MCP server that provides the code tools, as named in the session's MCP configuration. */
export const CODE_TOOLS_SERVER = 'code'
/** The code tools by their own names, as the MCP server lists them. */
export const CODE_TOOL_NAMES = ['list_code_files', 'search_code', 'read_code_file'] as const
/** The only MCP tools a session may ever call: read-only, over its own Code Folders. */
export const CODE_TOOLS: string[] = CODE_TOOL_NAMES.map((tool) => `mcp__${CODE_TOOLS_SERVER}__${tool}`)

export type Decision = { allow: true } | { allow: false; reason: string }

export const ALLOWED_SKILLS = ['grill-with-docs']
/** Tools a session is started with (`--tools`); everything else does not even exist for it. */
export const SESSION_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'MultiEdit',
  'Bash',
  'WebSearch',
  'WebFetch',
  'TodoWrite',
  'Skill',
]

// Either path separator, so a pattern is split the same way on every platform.
const PATH_SEPARATOR = /[\\/]/

const ALLOW: Decision = { allow: true }
const deny = (reason: string): Decision => ({ allow: false, reason })

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

function inside(dir: string, filePath: string) {
  const rel = path.relative(dir, filePath)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Absolute, normalised and symlink-resolved; relative paths resolve against the Project folder. */
const resolve = (ctx: GuardContext, filePath: string) => ctx.realpath(path.resolve(ctx.projectDir, filePath))

function readable(ctx: GuardContext, filePath: string | undefined, what: string): Decision {
  if (filePath === undefined) return ALLOW // defaults to the working directory, which is the Project folder
  return inside(ctx.projectDir, resolve(ctx, filePath))
    ? ALLOW
    : deny(`${what} "${filePath}" is outside the Project folder; sessions may only read inside ${ctx.projectDir}.`)
}

const climbs = (pattern: string) => path.isAbsolute(pattern) || pattern.split(PATH_SEPARATOR).includes('..')

/**
 * The one file every session may write: its own submission, read by the submit command. Compared against the
 * unresolved expected path, so a symlinked .submit folder resolves elsewhere and is refused.
 */
const isPayloadFile = (ctx: GuardContext, filePath: string | undefined) =>
  !!filePath && resolve(ctx, filePath) === path.join(ctx.projectDir, submitPayloadFile(ctx.sessionId))

function writable(ctx: GuardContext, filePath: string | undefined): Decision {
  const why = `Sessions may edit only the Glossary (CONTEXT.md), markdown decision records under plan/ and the submission file ${submitPayloadFile(ctx.sessionId)}. Drafts change only through the submit command.`
  if (!filePath) return deny(`No file_path given. ${why}`)
  const real = resolve(ctx, filePath)
  if (real === path.join(ctx.projectDir, 'CONTEXT.md')) return ALLOW
  const planDir = path.join(ctx.projectDir, 'plan')
  if (inside(planDir, real) && real.endsWith('.md') && real !== planDir) return ALLOW
  return deny(`Writing "${filePath}" is not allowed. ${why}`)
}

/** A Prototype Session's one writable file; its folder is the guard's `projectDir`. */
function writablePrototype(ctx: GuardContext, filePath: string | undefined): Decision {
  const why = `A Prototype Session may write only ${PROTOTYPE_FILE} and ${submitPayloadFile(ctx.sessionId)} in its own folder. Submit it with the submit command.`
  if (!filePath) return deny(`No file_path given. ${why}`)
  return resolve(ctx, filePath) === path.join(ctx.projectDir, PROTOTYPE_FILE)
    ? ALLOW
    : deny(`Writing "${filePath}" is not allowed. ${why}`)
}

/**
 * The only Bash a session may run: `node "<submitScript>"`, matched exactly, so nothing can be chained onto it.
 * The script reads its JSON from the payload file, so the payload never passes through a shell.
 */
function submitCommand(ctx: GuardContext, command: unknown): Decision {
  const allowed = new Set([`node "${ctx.submitScript}"`, `node ${ctx.submitScript}`])
  const usage = `The only allowed Bash command is:\nnode "${ctx.submitScript}"\nWrite the JSON to ${submitPayloadFile(ctx.sessionId)} first.`
  if (typeof command !== 'string') return deny(usage)
  return allowed.has(command.trim()) ? ALLOW : deny(usage)
}

/** Write, Edit and MultiEdit: what each kind of session may change. */
function writeDecision(ctx: GuardContext, filePath: string | undefined): Decision {
  if (ctx.mode === 'template')
    return deny(`A Template Session writes only ${submitPayloadFile(ctx.sessionId)} — then runs the submit command.`)
  if (ctx.mode === 'prototype') return writablePrototype(ctx, filePath)
  return writable(ctx, filePath)
}

function skillDecision(ctx: GuardContext, skill: string): Decision {
  if (ctx.mode === 'template') return deny('No skills are available in a Template Session.')
  if (ctx.mode === 'prototype') return deny('No skills are available in a Prototype Session.')
  if (ALLOWED_SKILLS.includes(skill)) return ALLOW
  return deny(`Only these skills are available: ${ALLOWED_SKILLS.join(', ')}.`)
}

export function decide(tool: string, input: Record<string, unknown>, ctx: GuardContext): Decision {
  switch (tool) {
    case 'Read':
      return str(input.file_path) ? readable(ctx, str(input.file_path), 'File') : deny('Read needs a file_path.')
    case 'Glob': {
      const pattern = str(input.pattern) ?? ''
      if (climbs(pattern)) return deny(`Glob pattern "${pattern}" must be relative and must not contain "..".`)
      return readable(ctx, str(input.path), 'Folder')
    }
    case 'Grep': {
      const glob = str(input.glob) ?? ''
      if (climbs(glob)) return deny(`Grep glob "${glob}" must be relative and must not contain "..".`)
      return readable(ctx, str(input.path), 'Path')
    }
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      if (isPayloadFile(ctx, str(input.file_path))) return ALLOW
      return writeDecision(ctx, str(input.file_path))
    case 'Bash':
      return submitCommand(ctx, input.command)
    case 'WebSearch':
    case 'WebFetch':
      return ctx.mode === 'prototype' ? deny('A Prototype Session has no web access.') : ALLOW
    case 'TodoWrite':
      return ALLOW
    case 'Skill':
      return skillDecision(ctx, str(input.skill) ?? '')
    default:
      if (CODE_TOOLS.includes(tool)) {
        if (ctx.mode === 'template') return deny('A Template Session reads no Code Folders.')
        if (ctx.mode === 'prototype') return deny('A Prototype Session reads no Code Folders.')
        return ctx.codeFolders ? ALLOW : deny('This session was started without reading Code Folders.')
      }
      return deny(`${tool} is not available in a Grilling Session.`)
  }
}
