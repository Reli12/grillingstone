// Permission Guard (ADR-0006): the decision behind the PreToolUse hook of every headless session.
// Deny by default. Pattern-based permissions alone are bypassable, so paths are normalised and
// symlink-resolved, and the single allowed Bash command is matched exactly. For Codex, it answers what the
// sandbox sends out to the backend (ADR-0019).
import path from 'node:path'

import { SUBMIT_HEREDOC, SUBMIT_TOOL } from '#core/session/cardProtocol.ts'

export interface GuardContext {
  /** Absolute, symlink-resolved Project folder. */
  projectDir: string
  /** Absolute path of scripts/writeDraft.mjs. */
  submitScript: string
  /** Resolves symlinks (for paths that do not exist yet: of their longest existing ancestor). */
  realpath: (filePath: string) => string
  /** A Template Session writes nothing and loads no skills; its folder is its own empty working folder. */
  mode?: 'grilling' | 'template'
}

export type Decision = { allow: true } | { allow: false; reason: string }

export const ALLOWED_SKILLS = ['grill-with-docs']
/** What a Grilling Session may write inside its Project: the Glossary, and decision records in this folder. */
export const GLOSSARY_FILE = 'CONTEXT.md'
export const DECISIONS_FOLDER = 'plan'
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
// Windows line endings, normalised to "\n" before splitting a command into lines.
const CRLF = /\r\n/g
// The newlines at the very end of a command.
const TRAILING_NEWLINES = /\n+$/

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

function writable(ctx: GuardContext, filePath: string | undefined): Decision {
  const why =
    'Sessions may edit only the Glossary (CONTEXT.md) and markdown decision records under plan/. Drafts change only through the submit command.'
  if (!filePath) return deny(`No file_path given. ${why}`)
  const real = resolve(ctx, filePath)
  if (real === path.join(ctx.projectDir, GLOSSARY_FILE)) return ALLOW
  const planDir = path.join(ctx.projectDir, DECISIONS_FOLDER)
  if (inside(planDir, real) && real.endsWith('.md') && real !== planDir) return ALLOW
  return deny(`Writing "${filePath}" is not allowed. ${why}`)
}

/**
 * The only Bash a session may run: `node "<submitScript>" <<'GRILLINGSTONE_JSON'` followed by the JSON and a final
 * GRILLINGSTONE_JSON line. The quoted delimiter disables every expansion inside the heredoc, and nothing may follow it.
 */
function submitCommand(ctx: GuardContext, command: unknown): Decision {
  const usage = `The only allowed Bash command is:\nnode "${ctx.submitScript}" <<'${SUBMIT_HEREDOC}'\n{ …json… }\n${SUBMIT_HEREDOC}`
  if (typeof command !== 'string') return deny(usage)
  const lines = command.replace(CRLF, '\n').replace(TRAILING_NEWLINES, '').split('\n')
  const opener = new Set([
    `node "${ctx.submitScript}" <<'${SUBMIT_HEREDOC}'`,
    `node ${ctx.submitScript} <<'${SUBMIT_HEREDOC}'`,
  ])
  if (!opener.has(lines[0].trim())) return deny(usage)
  const terminators = lines.map((line, i) => (line === SUBMIT_HEREDOC ? i : -1)).filter((i) => i > 0)
  if (terminators.length !== 1 || terminators[0] !== lines.length - 1)
    return deny(`The heredoc must end with a single final "${SUBMIT_HEREDOC}" line and nothing after it. ${usage}`)
  return ALLOW
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
      if (ctx.mode === 'template')
        return deny('A Template Session writes no files — submit the Template with the submit command instead.')
      return writable(ctx, str(input.file_path))
    case 'Bash':
      return submitCommand(ctx, input.command)
    case 'WebSearch':
    case 'WebFetch':
    case 'TodoWrite':
      return ALLOW
    case 'Skill':
      if (ctx.mode === 'template') return deny('No skills are available in a Template Session.')
      return ALLOWED_SKILLS.includes(str(input.skill) ?? '')
        ? ALLOW
        : deny(`Only these skills are available: ${ALLOWED_SKILLS.join(', ')}.`)
    default:
      return deny(`${tool} is not available in a Grilling Session.`)
  }
}

/** What each kind of Codex approval request is declined with. */
const CODEX_DECLINED: Record<string, string> = {
  'item/commandExecution/requestApproval':
    'Commands run only inside the sandbox: read the Project folder, with no network. Submit with submit_draft.',
  'item/fileChange/requestApproval':
    'Sessions may edit only the Glossary (CONTEXT.md) and decision records under plan/. Drafts change only through submit_draft.',
}

/** The Codex requests that ask to leave the sandbox; app-server expects a decision on them, not an error. */
export const CODEX_APPROVAL_REQUESTS = Object.keys(CODEX_DECLINED)

/**
 * The answer to a request Codex's app-server sends the backend. The sandbox already holds the session to its
 * folder, and no legitimate step needs to leave it, so only the call to submit_draft is allowed.
 */
export function decideCodexRequest(method: string, params: Record<string, unknown>): Decision {
  if (method === 'item/tool/call')
    return params.tool === SUBMIT_TOOL ? ALLOW : deny(`Only the ${SUBMIT_TOOL} tool is available.`)
  return deny(CODEX_DECLINED[method] ?? `${method} is not available in a session.`)
}
